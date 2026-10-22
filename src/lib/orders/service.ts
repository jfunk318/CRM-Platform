import "server-only";
import type { OrderEventType, OrderType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nextOrderNumber, orderRef } from "./numbers";
import { repriceOrder } from "./pricing";

export class OrderError extends Error {}

export interface DecorationSpec {
  methodId: string;
  areaId?: string | null;
  location: string;
  colors?: number | null;
  stitches?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
  inkColors?: string[];
  needsArtwork?: boolean;
  needsDigitizing?: boolean;
  reuseScreens?: boolean;
  notes?: string | null;
}

export interface LineSpec {
  productId: string;
  colorId: string;
  /** sizeId → quantity; zero or missing sizes are dropped */
  quantities: Record<string, number>;
  decorations: DecorationSpec[];
  notes?: string | null;
}

async function logEvent(
  tx: Prisma.TransactionClient,
  orderId: string,
  type: OrderEventType,
  body: string,
  staffId: string | null,
) {
  await tx.orderEvent.create({ data: { orderId, type, body, staffId } });
}

export async function createOrder(input: {
  type: OrderType;
  customerId: string;
  staffId: string | null;
  title?: string | null;
}): Promise<string> {
  const id = await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUniqueOrThrow({
      where: { id: input.customerId },
      include: { addresses: { orderBy: { isDefault: "desc" } } },
    });
    const status = await tx.orderStatus.findFirst({
      where: { type: input.type, isDefault: true },
    });
    if (!status) throw new OrderError(`No default ${input.type.toLowerCase()} status is set up`);
    const ship = customer.addresses[0];
    const order = await tx.order.create({
      data: {
        type: input.type,
        number: await nextOrderNumber(tx, input.type),
        title: input.title,
        customerId: customer.id,
        companyId: customer.companyId,
        statusId: status.id,
        createdById: input.staffId,
        assignedToId: input.staffId,
        ...(ship && {
          shipName: ship.name,
          shipLine1: ship.line1,
          shipLine2: ship.line2,
          shipCity: ship.city,
          shipRegion: ship.region,
          shipPostalCode: ship.postalCode,
          shipCountry: ship.country,
        }),
      },
    });
    await logEvent(tx, order.id, "CREATED", `${input.type === "QUOTE" ? "Quote" : "Order"} ${orderRef(order)} created`, input.staffId);
    return order.id;
  });
  await repriceOrder(id);
  return id;
}

async function validateLine(spec: LineSpec) {
  const product = await db.product.findUnique({
    where: { id: spec.productId },
    include: { colors: true, sizes: true, variants: { where: { colorId: spec.colorId } } },
  });
  if (!product) throw new OrderError("Choose a product");
  const color = product.colors.find((c) => c.id === spec.colorId);
  if (!color) throw new OrderError("Choose a color");
  const sizes = Object.entries(spec.quantities).filter(([, q]) => q > 0);
  if (sizes.length === 0) throw new OrderError("Enter a quantity for at least one size");
  for (const [sizeId, qty] of sizes) {
    if (!Number.isInteger(qty)) throw new OrderError("Quantities must be whole numbers");
    const size = product.sizes.find((s) => s.id === sizeId);
    if (!size) throw new OrderError("Unknown size");
    if (!product.variants.some((v) => v.sizeId === sizeId)) {
      throw new OrderError(`${product.name} isn't offered in ${color.name} ${size.code}`);
    }
  }
  for (const d of spec.decorations) {
    if (!d.location.trim()) throw new OrderError("Every decoration needs a location");
  }
  return { product, color, sizes };
}

const decorationData = (d: DecorationSpec, i: number) => ({
  methodId: d.methodId,
  areaId: d.areaId || null,
  location: d.location.trim(),
  colors: d.colors ?? null,
  stitches: d.stitches ?? null,
  widthIn: d.widthIn ?? null,
  heightIn: d.heightIn ?? null,
  inkColors: d.inkColors ?? [],
  needsArtwork: d.needsArtwork ?? false,
  needsDigitizing: d.needsDigitizing ?? false,
  reuseScreens: d.reuseScreens ?? false,
  notes: d.notes ?? null,
  sortOrder: i,
});

export async function addLine(orderId: string, spec: LineSpec, staffId: string | null): Promise<string> {
  const { product, color, sizes } = await validateLine(spec);
  const lineId = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { _count: { select: { lines: true } } } });
    const design = await tx.design.create({
      data: {
        name: `${product.name} — ${color.name}`,
        productId: product.id,
        colorId: color.id,
        customerId: order.customerId,
        decorations: { create: spec.decorations.map(decorationData) },
      },
    });
    const line = await tx.orderLine.create({
      data: {
        orderId,
        designId: design.id,
        notes: spec.notes,
        sortOrder: order._count.lines,
        sizes: { create: sizes.map(([sizeId, qty]) => ({ sizeId, qty })) },
      },
    });
    await logEvent(tx, orderId, "EDITED", `Added ${product.name} (${color.name})`, staffId);
    return line.id;
  });
  await repriceOrder(orderId);
  return lineId;
}

/**
 * Edit a line. Its design is updated in place unless another line or store
 * also uses it, in which case the line gets its own copy so the others are
 * unaffected.
 */
export async function updateLine(lineId: string, spec: LineSpec, staffId: string | null): Promise<void> {
  const { product, color, sizes } = await validateLine(spec);
  const line = await db.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { order: true, design: { include: { _count: { select: { orderLines: true } } } } },
  });
  await db.$transaction(async (tx) => {
    const shared = line.design._count.orderLines > 1;
    const designData = { name: `${product.name} — ${color.name}`, productId: product.id, colorId: color.id };
    let designId = line.designId;
    if (shared) {
      const copy = await tx.design.create({
        data: { ...designData, customerId: line.order.customerId, decorations: { create: spec.decorations.map(decorationData) } },
      });
      designId = copy.id;
    } else {
      await tx.design.update({ where: { id: designId }, data: designData });
      await tx.designDecoration.deleteMany({ where: { designId } });
      await tx.designDecoration.createMany({ data: spec.decorations.map((d, i) => ({ ...decorationData(d, i), designId })) });
    }
    await tx.orderLine.update({ where: { id: lineId }, data: { designId, notes: spec.notes } });
    await tx.orderLineSize.deleteMany({ where: { lineId } });
    await tx.orderLineSize.createMany({ data: sizes.map(([sizeId, qty]) => ({ lineId, sizeId, qty })) });
    await logEvent(tx, line.orderId, "EDITED", `Updated ${product.name} (${color.name})`, staffId);
  });
  await repriceOrder(line.orderId);
}

export async function removeLine(lineId: string, staffId: string | null): Promise<void> {
  const line = await db.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { design: { include: { product: true, color: true } } },
  });
  await db.$transaction(async (tx) => {
    await tx.orderLine.delete({ where: { id: lineId } });
    await logEvent(tx, line.orderId, "EDITED", `Removed ${line.design.product.name} (${line.design.color.name})`, staffId);
  });
  await repriceOrder(line.orderId);
}

export async function setStatus(orderId: string, statusId: string, staffId: string | null): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { status: true } });
    const status = await tx.orderStatus.findUniqueOrThrow({ where: { id: statusId } });
    if (status.type !== order.type) throw new OrderError("That status belongs to the other document type");
    if (status.id === order.statusId) return;
    await tx.order.update({ where: { id: orderId }, data: { statusId } });
    await logEvent(tx, orderId, "STATUS", `Status: ${order.status.name} → ${status.name}`, staffId);
  });
}

export async function assign(orderId: string, assigneeId: string | null, staffId: string | null): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.assignedToId === assigneeId) return;
    const who = assigneeId ? (await tx.staffUser.findUniqueOrThrow({ where: { id: assigneeId } })).name : "nobody";
    await tx.order.update({ where: { id: orderId }, data: { assignedToId: assigneeId } });
    await logEvent(tx, orderId, "ASSIGNED", `Assigned to ${who}`, staffId);
  });
}

export async function addNote(orderId: string, body: string, staffId: string | null): Promise<void> {
  if (!body.trim()) throw new OrderError("Write a note first");
  await db.orderEvent.create({ data: { orderId, type: "NOTE", body: body.trim(), staffId } });
}

/** Turn a quote into a new order. The quote keeps its lines and is marked converted. */
export async function convertQuote(quoteId: string, staffId: string | null): Promise<string> {
  const orderId = await db.$transaction(async (tx) => {
    const quote = await tx.order.findUniqueOrThrow({
      where: { id: quoteId },
      include: { lines: { include: { sizes: true } }, convertedTo: true },
    });
    if (quote.type !== "QUOTE") throw new OrderError("Only quotes can be converted");
    if (quote.convertedTo) throw new OrderError(`Already converted to order ${orderRef(quote.convertedTo)}`);
    if (quote.lines.length === 0) throw new OrderError("Add at least one item before converting");
    const problems = quote.lines.filter((l) => (l.issues as { severity: string }[]).some((i) => i.severity === "error"));
    if (problems.length) {
      throw new OrderError(`Fix the pricing problems on ${problems.length} item(s) before converting`);
    }
    const [orderStatus, convertedStatus] = await Promise.all([
      tx.orderStatus.findFirst({ where: { type: "ORDER", isDefault: true } }),
      tx.orderStatus.findFirst({ where: { type: "QUOTE", isConversion: true } }),
    ]);
    if (!orderStatus) throw new OrderError("No default order status is set up");

    const order = await tx.order.create({
      data: {
        type: "ORDER",
        number: await nextOrderNumber(tx, "ORDER"),
        quoteId: quote.id,
        title: quote.title,
        customerId: quote.customerId,
        companyId: quote.companyId,
        statusId: orderStatus.id,
        assignedToId: quote.assignedToId,
        createdById: staffId,
        pricingGroupId: quote.pricingGroupId,
        dueDate: quote.dueDate,
        rush: quote.rush,
        taxExempt: quote.taxExempt,
        customerNotes: quote.customerNotes,
        shipName: quote.shipName,
        shipLine1: quote.shipLine1,
        shipLine2: quote.shipLine2,
        shipCity: quote.shipCity,
        shipRegion: quote.shipRegion,
        shipPostalCode: quote.shipPostalCode,
        shipCountry: quote.shipCountry,
        shipping: quote.shipping,
        // Lines share the quote's designs; editing either side copies first.
        lines: {
          create: quote.lines.map((l) => ({
            designId: l.designId,
            notes: l.notes,
            sortOrder: l.sortOrder,
            sizes: { create: l.sizes.map((s) => ({ sizeId: s.sizeId, qty: s.qty })) },
          })),
        },
      },
    });
    if (convertedStatus) await tx.order.update({ where: { id: quote.id }, data: { statusId: convertedStatus.id } });
    await logEvent(tx, quote.id, "CONVERTED", `Converted to order ${orderRef(order)}`, staffId);
    await logEvent(tx, order.id, "CREATED", `Order ${orderRef(order)} created from quote ${orderRef(quote)}`, staffId);
    return order.id;
  });
  await repriceOrder(orderId);
  return orderId;
}

export interface OrderDetailsInput {
  title: string | null;
  dueDate: Date | null;
  rush: boolean;
  taxExempt: boolean;
  pricingGroupId: string | null;
  shipping: string;
  customerNotes: string | null;
  ship: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string;
  };
}

export async function updateDetails(orderId: string, input: OrderDetailsInput, staffId: string | null): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        title: input.title,
        dueDate: input.dueDate,
        rush: input.rush,
        taxExempt: input.taxExempt,
        pricingGroupId: input.pricingGroupId,
        shipping: input.shipping,
        customerNotes: input.customerNotes,
        shipName: input.ship.name,
        shipLine1: input.ship.line1,
        shipLine2: input.ship.line2,
        shipCity: input.ship.city,
        shipRegion: input.ship.region?.toUpperCase() ?? null,
        shipPostalCode: input.ship.postalCode,
        shipCountry: input.ship.country.toUpperCase() || "US",
      },
    });
    await logEvent(tx, orderId, "EDITED", "Updated details", staffId);
  });
  await repriceOrder(orderId);
}
