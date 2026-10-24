// Names and numbers: bought in a store, and typed as a roster by staff.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setUpBusiness } from "@/lib/platform/setup";
import { addLine, createOrder, OrderError, updateLine } from "@/lib/orders/service";
import { makeTestBusiness } from "@/test/fixtures";
import { cartTotals, findCartById } from "./cart";
import { placeOrderFromCart } from "./checkout";
import { createStoreItem } from "./items";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let itemId = "";
let M = "";

beforeAll(async () => {
  t = await makeTestBusiness(`names-${Date.now()}`);
  await setUpBusiness(t.db);
  M = t.product.sizes[0].id;
  const store = await t.db.store.findFirstOrThrow({ where: { kind: "ROOT" } });
  itemId = await createStoreItem(t.db, store.id, {
    name: "Jersey",
    description: null,
    productId: t.product.id,
    colorId: t.product.colors[0].id,
    sizeIds: [M],
    decorations: [{ methodId: t.method.id, location: "Front", colors: 1 }],
    batchQty: 24,
  });
  await t.db.storeItem.update({ where: { id: itemId }, data: { nameMode: "REQUIRED", namePrice: 5, numberMode: "OPTIONAL", numberPrice: 2, personalizationLocation: "Back" } });
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

describe("names and numbers bought in a store", () => {
  it("prices each name/number on top of the item, and keeps them on the order's roster", async () => {
    const store = await t.db.store.findFirstOrThrow({ where: { kind: "ROOT" } });
    const pickup = await t.db.deliveryMethod.findFirstOrThrow({ where: { kind: "PICKUP" } });
    const cart = await t.db.cart.create({
      data: {
        businessId: t.business.id,
        storeId: store.id,
        tokenHash: `names-${Date.now()}`,
        email: "coach@example.com",
        firstName: "Sam",
        lastName: "Coach",
        deliveryMethodId: pickup.id,
        items: {
          create: [
            { storeItemId: itemId, sizeId: M, qty: 1, name: "Smith", number: "12" },
            { storeItemId: itemId, sizeId: M, qty: 2, name: "Lee", number: "" },
          ],
        },
      },
    });
    const totals = await cartTotals(t.db, { business: t.business, store }, (await findCartById(t.db, cart.id))!);
    // Item 11.67; Smith #12 adds 5 + 2, Lee adds 5.
    expect(totals.lines.map((l) => [l.detail, l.unitPrice.toFixed(2), l.total.toFixed(2)])).toEqual([
      ["Navy · M · Smith #12", "18.67", "18.67"],
      ["Navy · M · Lee", "16.67", "33.34"],
    ]);
    const order = await placeOrderFromCart(t.db, cart.id, null, "http://shop.localhost:3000");
    const o = await t.db.order.findUniqueOrThrow({ where: { id: order.id }, include: { lines: { include: { sizes: true, names: { orderBy: { sortOrder: "asc" } } } } } });
    expect(o.lines).toHaveLength(1);
    const [line] = o.lines;
    // One size row at the item's price; the names carry what they added.
    expect(line.sizes.map((s) => [s.qty, s.unitPrice.toFixed(2)])).toEqual([[3, "11.67"]]);
    expect(line.names.map((n) => [n.name, n.number, n.qty, n.charge.toFixed(2)])).toEqual([
      ["Smith", "12", 1, "7.00"],
      ["Lee", "", 2, "5.00"],
    ]);
    expect(line.total.toFixed(2)).toBe("52.01");
    expect(o.merchandise.toFixed(2)).toBe(totals.merchandise.toFixed(2));

    // Staff fix a typo: the corrected entry starts without a charge; the others keep theirs.
    await updateLine(t.db, line.id, { ...t.line(3), quantities: { [M]: 3 }, decorations: [], roster: "M, Smith, 12\nM, Li\nM, Lee" }, t.staff.id);
    const after = await t.db.orderLine.findUniqueOrThrow({ where: { id: line.id }, include: { names: { orderBy: { sortOrder: "asc" } } } });
    expect(after.names.map((n) => [n.name, n.qty, n.charge.toFixed(2)])).toEqual([
      ["Smith", 1, "7.00"],
      ["Li", 1, "0.00"],
      ["Lee", 1, "5.00"],
    ]);
    expect(after.total.toFixed(2)).toBe("47.01");
  });
});

describe("rosters typed by staff", () => {
  it("saves names per size, keeps them when the roster isn't touched, and checks quantities", async () => {
    const orderId = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
    const lineId = await addLine(t.db, orderId, { ...t.line(12), roster: "M, Garcia, 7\nm 23\nM, Garcia, 7" }, t.staff.id);
    const names = () => t.db.orderLineName.findMany({ where: { lineId }, orderBy: { sortOrder: "asc" } });
    expect((await names()).map((n) => [n.name, n.number, n.qty, n.charge.toFixed(2)])).toEqual([
      ["Garcia", "7", 2, "0.00"],
      ["", "23", 1, "0.00"],
    ]);
    // Staff-priced lines aren't changed by a roster.
    const line = await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId } });
    await updateLine(t.db, lineId, t.line(12), t.staff.id);
    expect(await names()).toHaveLength(2);
    expect((await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId } })).total.toFixed(2)).toBe(line.total.toFixed(2));
    await expect(updateLine(t.db, lineId, t.line(2), t.staff.id)).rejects.toThrow("The roster has 3 M but only 2 are ordered");
    await expect(updateLine(t.db, lineId, { ...t.line(12), roster: "XL, Kim" }, t.staff.id)).rejects.toThrow(OrderError);
    await updateLine(t.db, lineId, { ...t.line(12), roster: "" }, t.staff.id);
    expect(await names()).toHaveLength(0);
  });
});

