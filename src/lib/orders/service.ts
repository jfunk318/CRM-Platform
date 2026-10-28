import "server-only";
import { randomBytes } from "node:crypto";
import type { OrderEventType, OrderType, Prisma, StatusRole } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { nextOrderNumber, orderRef } from "./numbers";
import { itemPrice } from "@/lib/store/settings";
import { repriceOrder } from "./pricing";
import { emitAutomation } from "@/lib/automation/events";
import { parseRoster, PersonalizationError } from "@/lib/store/personalization";

export class OrderError extends Error {}

/** An unguessable token for a customer link. */
export const newToken = () => randomBytes(24).toString("base64url");

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
  artwork?: ArtworkSpec | null;
}

/** Artwork placed on a decoration (see DesignDecoration in the schema). */
export interface ArtworkSpec {
  artworkFileId: string;
  sourceFileId: string | null;
  edits: Record<string, unknown>;
  widthPx: number;
  heightPx: number;
  x: number;
  y: number;
  w: number;
  rotation: number;
}

export interface LineSpec {
  productId: string;
  colorId: string;
  /** sizeId → quantity; zero or missing sizes are dropped */
  quantities: Record<string, number>;
  decorations: DecorationSpec[];
  notes?: string | null;
  /** Names and numbers as staff type them ("L, Smith, 12" per piece); undefined keeps the line's roster. */
  roster?: string | null;
}

export async function logEvent(
  tx: BusinessTx,
  businessId: string,
  orderId: string,
  type: OrderEventType,
  body: string,
  staffId: string | null,
) {
  await tx.orderEvent.create({ data: { businessId, orderId, type, body, staffId } });
}

/**
 * Move a quote/order to the status tagged with `role`, if the business has
 * one and the order isn't closed. Logs the change with the reason.
 */
export async function moveToRole(
  tx: BusinessTx,
  businessId: string,
  orderId: string,
  role: StatusRole,
  staffId: string | null,
  reason: string,
  { forwardOnly = false }: { forwardOnly?: boolean } = {},
): Promise<void> {
  const [order, status] = await Promise.all([
    tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { status: true } }),
    tx.orderStatus.findFirst({ where: { role } }),
  ]);
  if (!status || status.type !== order.type || status.id === order.statusId || order.status.isClosed) return;
  // Production, purchasing and shipping only move an order further along the list.
  if (forwardOnly && status.sortOrder <= order.status.sortOrder) return;
  await tx.order.update({ where: { id: orderId }, data: { statusId: status.id } });
  await logEvent(tx, businessId, orderId, "STATUS", `Status: ${order.status.name} → ${status.name} (${reason})`, staffId);
  await emitAutomation(tx, { trigger: "STATUS_CHANGED", orderId, statusId: status.id });
}

/** A customer approved a specific version of a quote; any change clears that approval. */
async function clearQuoteApproval(db: BusinessDb, orderId: string, staffId: string | null): Promise<void> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.type !== "QUOTE" || !order.approvedAt) return;
  await db.order.update({ where: { id: orderId }, data: { approvedAt: null, approvedByName: null } });
  await logEvent(db, db.$businessId, orderId, "CUSTOMER", "The quote changed after the customer approved it, so it needs approving again", staffId);
}

export async function createOrder(
  db: BusinessDb,
  input: { type: OrderType; customerId: string; staffId: string | null; title?: string | null },
): Promise<string> {
  const businessId = db.$businessId;
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
        businessId,
        type: input.type,
        number: await nextOrderNumber(tx, businessId, input.type),
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
    await logEvent(tx, businessId, order.id, "CREATED", `${input.type === "QUOTE" ? "Quote" : "Order"} ${orderRef(order)} created`, input.staffId);
    await emitAutomation(tx, { trigger: input.type === "QUOTE" ? "QUOTE_CREATED" : "ORDER_CREATED", orderId: order.id });
    return order.id;
  });
  await repriceOrder(db, id);
  return id;
}

async function validateLine(db: BusinessDb, spec: LineSpec) {
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

type RosterRow = { sizeId: string; name: string; number: string; qty: number; charge: Prisma.Decimal.Value; sortOrder: number };

/**
 * The line's names and numbers: what staff typed (or, if they didn't touch
 * it, what the line had), with no more names per size than pieces ordered.
 * Entries kept from before keep what the shopper paid for them.
 */
function rosterRows(
  spec: LineSpec,
  productSizes: { id: string; code: string }[],
  sizes: [string, number][],
  existing: { sizeId: string; name: string; number: string; qty: number; charge: Prisma.Decimal }[],
): RosterRow[] {
  let rows: RosterRow[];
  if (spec.roster === undefined || spec.roster === null) {
    rows = existing.map((e, i) => ({ ...e, sortOrder: i }));
  } else {
    let parsed;
    try {
      parsed = parseRoster(spec.roster, productSizes.filter((s) => sizes.some(([id]) => id === s.id)).map((s) => s.code));
    } catch (e) {
      if (e instanceof PersonalizationError) throw new OrderError(e.message);
      throw e;
    }
    rows = parsed.map((e, i) => {
      const sizeId = productSizes.find((s) => s.code === e.sizeCode)!.id;
      const before = existing.find((x) => x.sizeId === sizeId && x.name === e.name && x.number === e.number);
      return { sizeId, name: e.name, number: e.number, qty: e.qty, charge: before?.charge ?? 0, sortOrder: i };
    });
  }
  for (const [sizeId, qty] of sizes) {
    const named = rows.filter((r) => r.sizeId === sizeId).reduce((n, r) => n + r.qty, 0);
    const code = productSizes.find((s) => s.id === sizeId)?.code;
    if (named > qty) throw new OrderError(`The roster has ${named} ${code} but only ${qty} ${qty === 1 ? "is" : "are"} ordered`);
  }
  const orphan = rows.find((r) => !sizes.some(([id]) => id === r.sizeId));
  if (orphan) throw new OrderError(`The roster has ${productSizes.find((s) => s.id === orphan.sizeId)?.code ?? "a size"} names but none are ordered`);
  return rows;
}

/** A decoration's database row (without businessId and designId). */
export const decorationData = (d: DecorationSpec, i: number) => ({
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
  artworkFileId: d.artwork?.artworkFileId ?? null,
  sourceFileId: d.artwork?.sourceFileId ?? null,
  artEdits: (d.artwork?.edits ?? {}) as Prisma.InputJsonValue,
  artWidthPx: d.artwork?.widthPx ?? null,
  artHeightPx: d.artwork?.heightPx ?? null,
  placeX: d.artwork?.x ?? null,
  placeY: d.artwork?.y ?? null,
  placeW: d.artwork?.w ?? null,
  rotation: d.artwork?.rotation ?? 0,
});

/** The traced vector file recorded when artwork was enhanced for print. */
const vectorFileOf = (a: ArtworkSpec | null | undefined) => {
  const id = (a?.edits as { enhance?: { vectorFileId?: unknown } } | undefined)?.enhance?.vectorFileId;
  return typeof id === "string" ? id : null;
};

/**
 * Artwork files must be this business's; the originals (and traced vectors)
 * are also listed in the order's files so production can find them.
 */
async function checkArtwork(db: BusinessDb, spec: LineSpec) {
  const ids = spec.decorations.flatMap((d) => (d.artwork ? [d.artwork.artworkFileId, d.artwork.sourceFileId, vectorFileOf(d.artwork)] : [])).filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const found = await db.storedFile.count({ where: { id: { in: [...new Set(ids)] } } });
  if (found !== new Set(ids).size) throw new OrderError("That artwork file is missing; upload it again");
}

async function listArtworkOnOrder(tx: BusinessTx, businessId: string, orderId: string, spec: LineSpec) {
  const sources = [...new Set(spec.decorations.map((d) => d.artwork?.sourceFileId ?? d.artwork?.artworkFileId).filter((x): x is string => !!x))];
  for (const fileId of sources) {
    const exists = await tx.orderFile.findFirst({ where: { orderId, fileId } });
    if (!exists) await tx.orderFile.create({ data: { businessId, orderId, fileId, kind: "ARTWORK" } });
  }
  for (const fileId of new Set(spec.decorations.map((d) => vectorFileOf(d.artwork)).filter((x): x is string => !!x))) {
    const exists = await tx.orderFile.findFirst({ where: { orderId, fileId } });
    if (!exists) await tx.orderFile.create({ data: { businessId, orderId, fileId, kind: "PRODUCTION", note: "Traced to vector for print" } });
  }
}

export async function addLine(db: BusinessDb, orderId: string, spec: LineSpec, staffId: string | null): Promise<string> {
  const businessId = db.$businessId;
  const { product, color, sizes } = await validateLine(db, spec);
  const roster = rosterRows(spec, product.sizes, sizes, []);
  await checkArtwork(db, spec);
  const lineId = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { _count: { select: { lines: true } } } });
    await listArtworkOnOrder(tx, businessId, orderId, spec);
    const design = await tx.design.create({
      data: {
        businessId,
        name: `${product.name} — ${color.name}`,
        productId: product.id,
        colorId: color.id,
        customerId: order.customerId,
        decorations: { create: spec.decorations.map(decorationData) },
      },
    });
    const line = await tx.orderLine.create({
      data: {
        businessId,
        orderId,
        designId: design.id,
        notes: spec.notes,
        sortOrder: order._count.lines,
        sizes: { create: sizes.map(([sizeId, qty]) => ({ sizeId, qty })) },
        names: { create: roster },
      },
    });
    await logEvent(tx, businessId, orderId, "EDITED", `Added ${product.name} (${color.name})`, staffId);
    return line.id;
  });
  await repriceOrder(db, orderId);
  await clearQuoteApproval(db, orderId, staffId);
  return lineId;
}

/**
 * Edit a line. Its design is updated in place unless another line or store
 * also uses it, in which case the line gets its own copy so the others are
 * unaffected.
 */
export async function updateLine(db: BusinessDb, lineId: string, spec: LineSpec, staffId: string | null): Promise<void> {
  const businessId = db.$businessId;
  const { product, color, sizes } = await validateLine(db, spec);
  const line = await db.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    include: {
      order: true,
      sizes: true,
      names: { orderBy: { sortOrder: "asc" } },
      storeItem: { include: { prices: true, store: { include: { group: true } } } },
      design: { include: { _count: { select: { orderLines: true, storeItems: true } } } },
    },
  });
  // A store purchase keeps the prices it was sold at for sizes it already had;
  // added sizes take the store's price. A different garment goes back to the
  // price list.
  const sameGarment = line.design.productId === product.id && line.design.colorId === color.id;
  const fixedPrices = new Map<string, Prisma.Decimal>();
  if (line.fixedPrice && sameGarment) {
    for (const [sizeId] of sizes) {
      const old = line.sizes.find((s) => s.sizeId === sizeId);
      const fromStore = line.storeItem?.prices.find((p) => p.sizeId === sizeId);
      const price = old?.unitPrice ?? (fromStore && line.storeItem ? itemPrice(fromStore, line.storeItem, line.storeItem.store) : undefined);
      if (price) fixedPrices.set(sizeId, price);
    }
  }
  const keepFixed = line.fixedPrice && sameGarment && fixedPrices.size === sizes.length;
  // Another garment's sizes differ, so its roster starts from what was typed.
  const roster = rosterRows(spec, product.sizes, sizes, sameGarment ? line.names : []);
  await checkArtwork(db, spec);
  await db.$transaction(async (tx) => {
    await listArtworkOnOrder(tx, businessId, line.orderId, spec);
    // Designs used by other lines or by a store item are copied, never changed in place.
    const shared = line.design._count.orderLines > 1 || line.design._count.storeItems > 0;
    const designData = { name: `${product.name} — ${color.name}`, productId: product.id, colorId: color.id };
    let designId = line.designId;
    if (shared) {
      const copy = await tx.design.create({
        data: { ...designData, businessId, customerId: line.order.customerId, decorations: { create: spec.decorations.map(decorationData) } },
      });
      designId = copy.id;
    } else {
      await tx.design.update({ where: { id: designId }, data: designData });
      await tx.designDecoration.deleteMany({ where: { designId } });
      await tx.designDecoration.createMany({ data: spec.decorations.map((d, i) => ({ ...decorationData(d, i), businessId, designId })) });
    }
    await tx.orderLine.update({ where: { id: lineId }, data: { designId, notes: spec.notes, fixedPrice: keepFixed } });
    await tx.orderLineSize.deleteMany({ where: { lineId } });
    await tx.orderLineSize.createMany({ data: sizes.map(([sizeId, qty]) => ({ businessId, lineId, sizeId, qty, unitPrice: keepFixed ? fixedPrices.get(sizeId) : 0 })) });
    await tx.orderLineName.deleteMany({ where: { lineId } });
    await tx.orderLineName.createMany({ data: roster.map((r) => ({ ...r, businessId, lineId })) });
    await logEvent(
      tx,
      businessId,
      line.orderId,
      "EDITED",
      `Updated ${product.name} (${color.name})${line.fixedPrice && !keepFixed ? "; now priced from the price list instead of the store price" : ""}`,
      staffId,
    );
  });
  await repriceOrder(db, line.orderId);
  await clearQuoteApproval(db, line.orderId, staffId);
}

export async function removeLine(db: BusinessDb, lineId: string, staffId: string | null): Promise<void> {
  const businessId = db.$businessId;
  const line = await db.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { design: { include: { product: true, color: true } } },
  });
  await db.$transaction(async (tx) => {
    await tx.shipmentItem.updateMany({ where: { lineId }, data: { lineId: null } });
    await tx.orderLine.delete({ where: { id: lineId } });
    await logEvent(tx, businessId, line.orderId, "EDITED", `Removed ${line.design.product.name} (${line.design.color.name})`, staffId);
  });
  await repriceOrder(db, line.orderId);
  await clearQuoteApproval(db, line.orderId, staffId);
}

export async function setStatus(
  db: BusinessDb,
  orderId: string,
  statusId: string,
  staffId: string | null,
  o: { depth?: number; reason?: string } = {},
): Promise<void> {
  const businessId = db.$businessId;
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { status: true } });
    const status = await tx.orderStatus.findUniqueOrThrow({ where: { id: statusId } });
    if (status.type !== order.type) throw new OrderError("That status belongs to the other document type");
    if (status.id === order.statusId) return;
    await tx.order.update({ where: { id: orderId }, data: { statusId } });
    await logEvent(tx, businessId, orderId, "STATUS", `Status: ${order.status.name} → ${status.name}${o.reason ? ` (${o.reason})` : ""}`, staffId);
    await emitAutomation(tx, { trigger: "STATUS_CHANGED", orderId, statusId, depth: o.depth });
  });
}

export async function assign(db: BusinessDb, orderId: string, assigneeId: string | null, staffId: string | null): Promise<void> {
  const businessId = db.$businessId;
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.assignedToId === assigneeId) return;
    const who = assigneeId ? (await tx.staffUser.findUniqueOrThrow({ where: { id: assigneeId } })).name : "nobody";
    await tx.order.update({ where: { id: orderId }, data: { assignedToId: assigneeId } });
    await logEvent(tx, businessId, orderId, "ASSIGNED", `Assigned to ${who}`, staffId);
  });
}

export async function addNote(db: BusinessDb, orderId: string, body: string, staffId: string | null): Promise<void> {
  const businessId = db.$businessId;
  if (!body.trim()) throw new OrderError("Write a note first");
  await db.orderEvent.create({ data: { businessId, orderId, type: "NOTE", body: body.trim(), staffId } });
}

/** Turn a quote into a new order. The quote keeps its lines and is marked converted. */
export async function convertQuote(db: BusinessDb, quoteId: string, staffId: string | null): Promise<string> {
  const businessId = db.$businessId;
  const orderId = await db.$transaction(async (tx) => {
    const quote = await tx.order.findUniqueOrThrow({
      where: { id: quoteId },
      include: { lines: { include: { sizes: true, names: { orderBy: { sortOrder: "asc" } } } }, convertedTo: true },
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
      tx.orderStatus.findFirst({ where: { role: "QUOTE_CONVERTED" } }),
    ]);
    if (!orderStatus) throw new OrderError("No default order status is set up");

    const order = await tx.order.create({
      data: {
        businessId,
        type: "ORDER",
        number: await nextOrderNumber(tx, businessId, "ORDER"),
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
        approvedAt: quote.approvedAt,
        approvedByName: quote.approvedByName,
        depositRequired: quote.depositRequired,
        // A customer who had the quote link gets one for the order too.
        publicToken: quote.publicToken ? newToken() : null,
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
            // The roster comes along.
            names: { create: l.names.map((n) => ({ sizeId: n.sizeId, name: n.name, number: n.number, qty: n.qty, charge: n.charge, sortOrder: n.sortOrder })) },
          })),
        },
      },
    });
    if (convertedStatus) {
      await tx.order.update({ where: { id: quote.id }, data: { statusId: convertedStatus.id } });
      await emitAutomation(tx, { trigger: "STATUS_CHANGED", orderId: quote.id, statusId: convertedStatus.id });
    }
    await logEvent(tx, businessId, quote.id, "CONVERTED", `Converted to order ${orderRef(order)}`, staffId);
    await logEvent(tx, businessId, order.id, "CREATED", `Order ${orderRef(order)} created from quote ${orderRef(quote)}`, staffId);
    await emitAutomation(tx, { trigger: "ORDER_CREATED", orderId: order.id });
    return order.id;
  });
  await repriceOrder(db, orderId);
  return orderId;
}

export interface OrderDetailsInput {
  title: string | null;
  dueDate: Date | null;
  rush: boolean;
  taxExempt: boolean;
  pricingGroupId: string | null;
  shipping: string;
  deliveryMethodId?: string | null;
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

export async function updateDetails(db: BusinessDb, orderId: string, input: OrderDetailsInput, staffId: string | null): Promise<void> {
  const businessId = db.$businessId;
  const current = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  let shipping = input.shipping;
  // Picking a different delivery method fills in its charge, unless the
  // shipping amount was changed by hand at the same time.
  const methodId = input.deliveryMethodId === undefined ? current.deliveryMethodId : input.deliveryMethodId;
  if (methodId && methodId !== current.deliveryMethodId && current.shipping.equals(input.shipping)) {
    const method = await db.deliveryMethod.findUniqueOrThrow({ where: { id: methodId } });
    shipping = method.freeOver && current.merchandise.gte(method.freeOver) ? "0.00" : method.price.toFixed(2);
  }
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        title: input.title,
        dueDate: input.dueDate,
        rush: input.rush,
        taxExempt: input.taxExempt,
        pricingGroupId: input.pricingGroupId,
        shipping,
        deliveryMethodId: methodId,
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
    await logEvent(tx, businessId, orderId, "EDITED", "Updated details", staffId);
  });
  const before = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { total: true } });
  await repriceOrder(db, orderId);
  const after = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { total: true } });
  // Notes or a due date don't change what was approved; price changes do.
  if (!before.total.equals(after.total)) await clearQuoteApproval(db, orderId, staffId);
}
