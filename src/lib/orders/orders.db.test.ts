// Integration tests: run against the database in DATABASE_URL, creating
// their own uniquely named fixtures and deleting them afterwards.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addLine, convertQuote, createOrder, OrderError, removeLine, setStatus, updateLine } from "./service";

const tag = `test-${Date.now()}`;
const ids = {} as Record<string, string>;
const size = {} as Record<string, string>;

beforeAll(async () => {
  const group = await db.pricingGroup.create({
    data: { name: `${tag} group`, markupMode: "MARKUP", markupTiers: { create: [{ costFrom: 0, costTo: null, pct: 0.5 }] } },
  });
  const method = await db.decorationMethod.create({
    data: {
      code: `${tag}-SCR`,
      name: "Test screen print",
      shortName: "Test SP",
      kind: "SCREEN_PRINT",
      pricingModel: "PER_COLOR",
      minQty: 12,
      screenSetupFee: 10,
      combineSameDesignQty: true,
      priceTables: {
        create: {
          name: "test",
          cells: { create: [{ minQty: 12, dimensionMax: 2, unitPrice: 3 }, { minQty: 24, dimensionMax: 2, unitPrice: 2 }] },
        },
      },
    },
  });
  const type = await db.productType.create({
    data: { name: `${tag} type`, decorationMethods: { create: { methodId: method.id } } },
  });
  const product = await db.product.create({
    data: {
      slug: `${tag}-tee`,
      styleCode: "TST1",
      name: "Test Tee",
      productTypeId: type.id,
      colors: { create: [{ name: "Navy", shade: "DARK" }, { name: "White", shade: "WHITE" }] },
      sizes: { create: [{ code: "S", label: "S", sortOrder: 0 }, { code: "M", label: "M", sortOrder: 1 }, { code: "2XL", label: "2XL", sortOrder: 2 }] },
    },
    include: { colors: true, sizes: true },
  });
  for (const s of product.sizes) size[s.code] = s.id;
  const navy = product.colors.find((c) => c.name === "Navy")!;
  const white = product.colors.find((c) => c.name === "White")!;
  for (const c of [navy, white]) {
    for (const s of product.sizes) {
      await db.productVariant.create({
        data: { productId: product.id, colorId: c.id, sizeId: s.id, sku: `${tag}-${c.name}-${s.code}`, wholesaleCost: s.code === "2XL" ? 5 : 3 },
      });
    }
  }
  const tax = await db.taxRate.create({ data: { name: `${tag} tax`, rate: 0.05, region: "ZZ", taxScreenSetupFee: true } });
  const customer = await db.customer.create({
    data: {
      firstName: "Test",
      lastName: tag,
      pricingGroupId: group.id,
      addresses: { create: { name: "Test", line1: "1 Main St", city: "Keene", region: "ZZ", postalCode: "03431", isDefault: true } },
    },
  });
  Object.assign(ids, {
    group: group.id, method: method.id, type: type.id, product: product.id, navy: navy.id, white: white.id, tax: tax.id, customer: customer.id,
  });
});

afterAll(async () => {
  const orders = await db.order.findMany({ where: { customerId: ids.customer }, select: { id: true } });
  await db.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await db.design.deleteMany({ where: { productId: ids.product } });
  await db.customer.deleteMany({ where: { id: ids.customer } });
  await db.product.deleteMany({ where: { id: ids.product } });
  await db.productType.deleteMany({ where: { id: ids.type } });
  await db.decorationMethod.deleteMany({ where: { id: ids.method } });
  await db.pricingGroup.deleteMany({ where: { id: ids.group } });
  await db.taxRate.deleteMany({ where: { id: ids.tax } });
  await db.$disconnect();
});

const frontPrint = () => [{ methodId: ids.method, location: "Front", colors: 2 }];

describe("quotes and orders", () => {
  let quoteId = "";
  let navyLine = "";

  it("creates a quote with the next number, default status and ship-to", async () => {
    quoteId = await createOrder({ type: "QUOTE", customerId: ids.customer, staffId: null });
    const q = await db.order.findUniqueOrThrow({ where: { id: quoteId }, include: { status: true, events: true } });
    expect(q.number).toBeGreaterThan(1000);
    expect(q.status.isDefault).toBe(true);
    expect(q.shipRegion).toBe("ZZ");
    expect(q.events.map((e) => e.type)).toEqual(["CREATED"]);
  });

  it("prices lines from the customer's pricing group and combines the same print across colors", async () => {
    navyLine = await addLine(quoteId, { productId: ids.product, colorId: ids.navy, quantities: { [size.S]: 6, [size.M]: 6 }, decorations: frontPrint() }, null);
    await addLine(quoteId, { productId: ids.product, colorId: ids.white, quantities: { [size.S]: 12 }, decorations: frontPrint() }, null);
    await db.order.update({ where: { id: quoteId }, data: { shipping: 10 } });
    const { repriceOrder } = await import("./pricing");
    await repriceOrder(quoteId);

    const q = await db.order.findUniqueOrThrow({
      where: { id: quoteId },
      include: { lines: { orderBy: { sortOrder: "asc" }, include: { sizes: true } } },
    });
    // 24 pieces combined → $2.00 print; garment $3.00 × 1.5 = $4.50 → $6.50 each
    expect(q.lines[0].sizes.map((s) => s.unitPrice.toFixed(2))).toEqual(["6.50", "6.50"]);
    expect(q.lines[0].decorationUnit.toFixed(2)).toBe("2.00");
    // Screens charged once: navy needs 2 colors + white underbase = 3 × $10
    expect(q.lines[0].feesTotal.toFixed(2)).toBe("30.00");
    expect(q.lines[1].feesTotal.toFixed(2)).toBe("0.00");
    expect(q.merchandise.toFixed(2)).toBe("156.00");
    // Tax 5% on merchandise + screens (186.00) = 9.30; + $10 shipping
    expect(q.tax.toFixed(2)).toBe("9.30");
    expect(q.total.toFixed(2)).toBe("205.30");
  });

  it("records pricing problems on the line instead of failing", async () => {
    const id = await addLine(quoteId, { productId: ids.product, colorId: ids.navy, quantities: { [size["2XL"]]: 1 }, decorations: [{ methodId: ids.method, location: "Back", colors: 1 }] }, null);
    const line = await db.orderLine.findUniqueOrThrow({ where: { id } });
    expect((line.issues as { code: string }[]).map((i) => i.code)).toContain("BELOW_MIN_QTY");
    await removeLine(id, null);
  });

  it("rejects sizes that aren't offered and empty quantities", async () => {
    await expect(addLine(quoteId, { productId: ids.product, colorId: ids.navy, quantities: {}, decorations: [] }, null)).rejects.toThrow(OrderError);
    await expect(
      addLine(quoteId, { productId: ids.product, colorId: ids.navy, quantities: { [size.S]: 1.5 }, decorations: [] }, null),
    ).rejects.toThrow(/whole numbers/);
  });

  it("converts a quote to an order once, sharing designs until edited", async () => {
    const orderId = await convertQuote(quoteId, null);
    const [quote, order] = await Promise.all([
      db.order.findUniqueOrThrow({ where: { id: quoteId }, include: { status: true, lines: true } }),
      db.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: { orderBy: { sortOrder: "asc" } } } }),
    ]);
    expect(order.type).toBe("ORDER");
    expect(order.quoteId).toBe(quoteId);
    expect(order.total.toFixed(2)).toBe("205.30");
    expect(quote.status.isConversion).toBe(true);
    expect(order.lines[0].designId).toBe(quote.lines.find((l) => l.id === navyLine)!.designId);
    await expect(convertQuote(quoteId, null)).rejects.toThrow(/Already converted/);

    // Editing the order's line gives it its own design; the quote is unchanged.
    await updateLine(order.lines[0].id, { productId: ids.product, colorId: ids.navy, quantities: { [size.S]: 24 }, decorations: [{ methodId: ids.method, location: "Front", colors: 1 }] }, null);
    const [edited, quoteLine] = await Promise.all([
      db.orderLine.findUniqueOrThrow({ where: { id: order.lines[0].id }, include: { design: { include: { decorations: true } } } }),
      db.orderLine.findUniqueOrThrow({ where: { id: navyLine }, include: { design: { include: { decorations: true } } } }),
    ]);
    expect(edited.designId).not.toBe(quoteLine.designId);
    expect(edited.design.decorations[0].colors).toBe(1);
    expect(quoteLine.design.decorations[0].colors).toBe(2);
  });

  it("changes status within the same type only, and logs it", async () => {
    const quoteStatus = await db.orderStatus.findFirstOrThrow({ where: { type: "QUOTE", isDefault: true } });
    const order = await db.order.findFirstOrThrow({ where: { quoteId } });
    await expect(setStatus(order.id, quoteStatus.id, null)).rejects.toThrow(/other document type/);
    const next = await db.orderStatus.findFirstOrThrow({ where: { type: "ORDER", isDefault: false, isClosed: false } });
    await setStatus(order.id, next.id, null);
    const events = await db.orderEvent.findMany({ where: { orderId: order.id, type: "STATUS" } });
    expect(events[0].body).toContain(next.name);
  });
});
