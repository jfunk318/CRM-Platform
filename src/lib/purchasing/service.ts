import "server-only";
import { Prisma } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { deliveryNote, isValidEmail, sendEmail } from "@/lib/email/mailer";
import { purchaseOrderEmail } from "@/lib/email/templates";
import { nextNumber, poRef } from "@/lib/orders/numbers";
import { logEvent, moveToRole, OrderError } from "@/lib/orders/service";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const variantKey = (productId: string, colorId: string, sizeId: string) => `${productId}:${colorId}:${sizeId}`;

const variantInclude = { product: { include: { supplier: true } }, color: true, size: true } satisfies Prisma.ProductVariantInclude;
export type VariantInfo = Prisma.ProductVariantGetPayload<{ include: typeof variantInclude }>;

/** "Gildan 5000 · Navy · M" */
export const variantLabel = (v: { product: { name: string; styleCode?: string }; color: { name: string }; size: { code: string } }) =>
  `${v.product.styleCode ? `${v.product.styleCode} ` : ""}${v.product.name} · ${v.color.name} · ${v.size.code}`;

// ─── What orders need ───────────────────────────────────────────────────

const needsOrderInclude = {
  customer: true,
  status: true,
  lines: { include: { sizes: true, design: true } },
  blankAllocations: true,
} satisfies Prisma.OrderInclude;

export type NeedRow = {
  key: string; // `${orderId}:${variantId}`
  variant: VariantInfo | null;
  label: string;
  needed: number;
  covered: number; // on a PO, from stock or supplied
  short: number;
};

/** Blanks each order needs, per garment variant, and how many are already covered. */
function needsFor(order: Prisma.OrderGetPayload<{ include: typeof needsOrderInclude }>, variants: Map<string, VariantInfo>, sizes: Map<string, { code: string }>): NeedRow[] {
  const need = new Map<string, { variant: VariantInfo | null; label: string; qty: number }>();
  for (const line of order.lines) {
    for (const s of line.sizes) {
      const v = variants.get(variantKey(line.design.productId, line.design.colorId, s.sizeId)) ?? null;
      const k = v ? v.id : `missing:${line.design.productId}:${line.design.colorId}:${s.sizeId}`;
      const row = need.get(k) ?? { variant: v, label: v ? variantLabel(v) : `${line.design.name} · ${sizes.get(s.sizeId)?.code ?? "?"} (no SKU)`, qty: 0 };
      row.qty += s.qty;
      need.set(k, row);
    }
  }
  const covered = new Map<string, number>();
  for (const a of order.blankAllocations) covered.set(a.variantId, (covered.get(a.variantId) ?? 0) + a.qty);
  // Blanks set aside for variants no longer on the order show as extra.
  for (const [variantId] of covered) if (!need.has(variantId)) need.set(variantId, { variant: variants.get(variantId) ?? null, label: "", qty: 0 });
  return [...need.entries()].map(([k, r]) => {
    const c = r.variant ? (covered.get(r.variant.id) ?? 0) : 0;
    return { key: `${order.id}:${k}`, variant: r.variant, label: r.label || (r.variant ? variantLabel(r.variant) : k), needed: r.qty, covered: c, short: Math.max(0, r.qty - c) };
  });
}

async function loadVariants(db: BusinessDb | BusinessTx, productIds: string[], extraIds: string[] = []) {
  const variants = await db.productVariant.findMany({
    where: { OR: [{ productId: { in: productIds } }, { id: { in: extraIds } }] },
    include: variantInclude,
  });
  const byKey = new Map<string, VariantInfo>();
  for (const v of variants) {
    byKey.set(variantKey(v.productId, v.colorId, v.sizeId), v);
    byKey.set(v.id, v);
  }
  return byKey;
}

/** Open orders (or the given ones, even if closed) and the blanks each still needs. */
export async function blankNeeds(db: BusinessDb | BusinessTx, orderIds?: string[], { includeClosed = false } = {}) {
  const orders = await db.order.findMany({
    where: { type: "ORDER", ...(includeClosed ? {} : { status: { isClosed: false } }), ...(orderIds ? { id: { in: orderIds } } : {}) },
    include: needsOrderInclude,
    orderBy: [{ rush: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { number: "asc" }],
  });
  const productIds = [...new Set(orders.flatMap((o) => o.lines.map((l) => l.design.productId)))];
  const variants = await loadVariants(db, productIds, orders.flatMap((o) => o.blankAllocations.map((a) => a.variantId)));
  const sizeRows = await db.productSize.findMany({ where: { productId: { in: productIds } } });
  const sizes = new Map(sizeRows.map((s) => [s.id, s]));
  return orders.map((order) => ({ order, rows: needsFor(order, variants, sizes) }));
}

// ─── Ordering blanks ────────────────────────────────────────────────────

async function repricePo(tx: BusinessTx, purchaseOrderId: string) {
  const lines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId } });
  const total = lines.reduce((t, l) => t.plus(D(l.unitCost).times(l.qty)), D(0));
  await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { total: total.toFixed(2) } });
}

/** The business's own address, the default ship-to for purchase orders. */
async function shopShipTo(tx: BusinessTx) {
  const b = await tx.business.findUniqueOrThrow({ where: { id: tx.$businessId } });
  return {
    shipToName: b.name,
    shipLine1: b.addressLine1,
    shipLine2: b.addressLine2,
    shipCity: b.city,
    shipRegion: b.region,
    shipPostalCode: b.postalCode,
    shipCountry: b.country,
  };
}

async function draftPoFor(tx: BusinessTx, supplierId: string, staffId: string | null) {
  const existing = await tx.purchaseOrder.findFirst({ where: { supplierId, status: "DRAFT" }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  const businessId = tx.$businessId;
  return tx.purchaseOrder.create({
    data: { businessId, number: await nextNumber(tx, businessId, "po"), supplierId, createdById: staffId, ...(await shopShipTo(tx)) },
  });
}

async function addToPo(tx: BusinessTx, purchaseOrderId: string, variant: VariantInfo, qty: number) {
  const line = await tx.purchaseOrderLine.findUnique({ where: { purchaseOrderId_variantId: { purchaseOrderId, variantId: variant.id } } });
  if (line) return tx.purchaseOrderLine.update({ where: { id: line.id }, data: { qty: line.qty + qty } });
  return tx.purchaseOrderLine.create({
    data: { businessId: tx.$businessId, purchaseOrderId, variantId: variant.id, qty, unitCost: variant.wholesaleCost },
  });
}

/**
 * Cover the shortfall on the chosen order/variant rows: from in-house stock
 * first (if asked), the rest on draft purchase orders, one per supplier.
 * Adds to an existing draft PO for the supplier, so orders consolidate.
 */
export async function orderBlanks(
  db: BusinessDb,
  keys: string[],
  { useStock, staffId }: { useStock: boolean; staffId: string | null },
): Promise<{ purchaseOrders: number; fromStock: number; onOrder: number }> {
  if (keys.length === 0) throw new OrderError("Choose at least one item");
  const businessId = db.$businessId;
  return db.$transaction(async (tx) => {
    const orderIds = [...new Set(keys.map((k) => k.split(":")[0]))];
    const needs = await blankNeeds(tx, orderIds);
    const picked = needs.flatMap(({ order, rows }) => rows.filter((r) => keys.includes(r.key) && r.short > 0).map((r) => ({ order, row: r })));
    if (picked.length === 0) throw new OrderError("Those items are already covered");
    const noSku = picked.find((p) => !p.row.variant);
    if (noSku) throw new OrderError(`${noSku.row.label} has no SKU in the catalog, so it can't be ordered`);
    const noSupplier = picked.find((p) => !p.row.variant!.product.supplierId);
    if (noSupplier) throw new OrderError(`${noSupplier.row.variant!.product.name} has no supplier; set one on the product first`);

    const pos = new Set<string>();
    const perOrder = new Map<string, { stock: number; po: Map<number, number> }>();
    let fromStock = 0;
    let onOrder = 0;
    for (const { order, row } of picked) {
      const v = row.variant!;
      let qty = row.short;
      const log = perOrder.get(order.id) ?? { stock: 0, po: new Map() };
      perOrder.set(order.id, log);
      if (useStock && v.stockOnHand && v.stockOnHand > 0) {
        const take = Math.min(qty, v.stockOnHand);
        // Only take what's still there if someone else used stock meanwhile.
        const ok = await tx.productVariant.updateMany({ where: { id: v.id, stockOnHand: { gte: take } }, data: { stockOnHand: { decrement: take } } });
        if (ok.count) {
          v.stockOnHand -= take;
          await tx.blankAllocation.create({ data: { businessId, orderId: order.id, variantId: v.id, qty: take, source: "STOCK" } });
          await tx.stockMovement.create({ data: { businessId, variantId: v.id, change: -take, reason: "USED", orderId: order.id, staffId } });
          qty -= take;
          fromStock += take;
          log.stock += take;
        }
      }
      if (qty === 0) continue;
      const po = await draftPoFor(tx, v.product.supplierId!, staffId);
      const line = await addToPo(tx, po.id, v, qty);
      await tx.blankAllocation.create({ data: { businessId, orderId: order.id, variantId: v.id, qty, source: "PO", poLineId: line.id } });
      pos.add(po.id);
      onOrder += qty;
      log.po.set(po.number, (log.po.get(po.number) ?? 0) + qty);
    }
    for (const id of pos) await repricePo(tx, id);
    for (const [orderId, l] of perOrder) {
      const parts = [...[...l.po].map(([n, q]) => `${q} on draft ${poRef(n)}`), ...(l.stock ? [`${l.stock} from stock`] : [])];
      if (parts.length) await logEvent(tx, businessId, orderId, "PURCHASING", `Blanks: ${parts.join(", ")}`, staffId);
    }
    return { purchaseOrders: pos.size, fromStock, onOrder };
  });
}

/** Mark blanks as covered without ordering them (customer-supplied, already here). */
export async function markBlanksSupplied(db: BusinessDb, key: string, note: string | null, staffId: string | null) {
  const [orderId, variantId] = key.split(":");
  const [need] = await blankNeeds(db, [orderId]);
  const row = need?.rows.find((r) => r.key === key);
  if (!row || !row.variant || row.short === 0) throw new OrderError("Nothing to cover for that item");
  await db.blankAllocation.create({ data: { businessId: db.$businessId, orderId, variantId, qty: row.short, source: "OTHER", note } });
  await logEvent(db, db.$businessId, orderId, "PURCHASING", `Blanks: ${row.short} × ${row.label} marked as supplied${note ? ` (${note})` : ""}`, staffId);
}

/** Undo a blank allocation: stock goes back, draft PO lines shrink. */
export async function releaseAllocation(db: BusinessDb, allocationId: string, staffId: string | null) {
  const businessId = db.$businessId;
  await db.$transaction(async (tx) => {
    const a = await tx.blankAllocation.findUniqueOrThrow({ where: { id: allocationId }, include: { poLine: { include: { purchaseOrder: true } }, variant: { include: variantInclude } } });
    const label = variantLabel(a.variant);
    if (a.source === "PO" && a.poLine) {
      if (a.poLine.purchaseOrder.status !== "DRAFT") throw new OrderError(`${poRef(a.poLine.purchaseOrder.number)} has been sent; change it with the supplier, or cancel it`);
      await tx.blankAllocation.delete({ where: { id: a.id } });
      if (a.poLine.qty - a.qty <= 0) await tx.purchaseOrderLine.delete({ where: { id: a.poLine.id } });
      else await tx.purchaseOrderLine.update({ where: { id: a.poLine.id }, data: { qty: a.poLine.qty - a.qty } });
      await repricePo(tx, a.poLine.purchaseOrderId);
      await logEvent(tx, businessId, a.orderId, "PURCHASING", `Took ${a.qty} × ${label} off ${poRef(a.poLine.purchaseOrder.number)}`, staffId);
      return;
    }
    await tx.blankAllocation.delete({ where: { id: a.id } });
    if (a.source === "STOCK") {
      await tx.productVariant.update({ where: { id: a.variantId }, data: { stockOnHand: { increment: a.qty } } });
      await tx.stockMovement.create({ data: { businessId, variantId: a.variantId, change: a.qty, reason: "RETURNED", orderId: a.orderId, staffId } });
      await logEvent(tx, businessId, a.orderId, "PURCHASING", `Returned ${a.qty} × ${label} to stock`, staffId);
    } else {
      await logEvent(tx, businessId, a.orderId, "PURCHASING", `Removed ${a.qty} × ${label} marked as supplied`, staffId);
    }
  });
}

// ─── An order's blanks ──────────────────────────────────────────────────

/**
 * Each blank an order needs with where it's coming from and how many are in
 * hand. A PO line's received quantity goes to its orders oldest first.
 */
export async function orderBlankStatus(db: BusinessDb, orderId: string) {
  const [need] = await blankNeeds(db, [orderId], { includeClosed: true });
  const allocations = await db.blankAllocation.findMany({
    where: { orderId },
    include: { poLine: { include: { purchaseOrder: { include: { supplier: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const lineIds = allocations.flatMap((a) => (a.poLineId ? [a.poLineId] : []));
  const siblings = await db.blankAllocation.findMany({ where: { poLineId: { in: lineIds } }, orderBy: { createdAt: "asc" } });
  const receivedFor = (a: (typeof allocations)[number]) => {
    if (a.source !== "PO") return a.qty;
    let left = a.poLine?.qtyReceived ?? 0;
    for (const s of siblings.filter((s) => s.poLineId === a.poLineId)) {
      const got = Math.min(s.qty, Math.max(0, left));
      if (s.id === a.id) return got;
      left -= got;
    }
    return 0;
  };
  const rows = (need?.rows ?? []).map((r) => {
    const sources = allocations.filter((a) => a.variantId === r.variant?.id).map((a) => ({ allocation: a, received: receivedFor(a) }));
    const inHand = sources.reduce((n, s) => n + s.received, 0);
    return { ...r, sources, inHand };
  });
  const ready = rows.length > 0 && rows.every((r) => r.inHand >= r.needed);
  return { rows, ready, orderOpen: !!need && !need.order.status.isClosed };
}

// ─── Purchase orders ────────────────────────────────────────────────────

export async function createPurchaseOrder(db: BusinessDb, supplierId: string, staffId: string | null): Promise<string> {
  await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  return db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: { businessId: tx.$businessId, number: await nextNumber(tx, tx.$businessId, "po"), supplierId, createdById: staffId, ...(await shopShipTo(tx)) },
    });
    return po.id;
  });
}

async function draftOnly(tx: BusinessTx, purchaseOrderId: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId } });
  if (po.status !== "DRAFT") throw new OrderError(`${poRef(po.number)} has been sent and can't be changed here`);
  return po;
}

export type PoDetails = {
  shipToName: string | null;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipRegion: string | null;
  shipPostalCode: string | null;
  shipCountry: string;
  blindShip: boolean;
  notes: string | null;
  expectedAt: Date | null;
};

export async function updatePurchaseOrder(db: BusinessDb, purchaseOrderId: string, d: PoDetails) {
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId } });
  if (po.status === "CANCELLED") throw new OrderError("This purchase order is cancelled");
  await db.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { ...d, shipRegion: d.shipRegion?.toUpperCase() ?? null } });
}

/** Add stock items to a draft PO by SKU or supplier SKU. */
export async function addPoItem(db: BusinessDb, purchaseOrderId: string, sku: string, qty: number) {
  if (qty < 1) throw new OrderError("Quantity must be at least 1");
  await db.$transaction(async (tx) => {
    const po = await draftOnly(tx, purchaseOrderId);
    const variant = await tx.productVariant.findFirst({ where: { OR: [{ sku }, { supplierSku: sku }] }, include: variantInclude });
    if (!variant) throw new OrderError(`No product has SKU ${sku}`);
    if (variant.product.supplierId !== po.supplierId) throw new OrderError(`${variantLabel(variant)} comes from ${variant.product.supplier?.name ?? "no supplier"}, not this supplier`);
    await addToPo(tx, purchaseOrderId, variant, qty);
    await repricePo(tx, purchaseOrderId);
  });
}

/** Change a draft line's quantity or cost. It can't drop below what orders are counting on. */
export async function updatePoLine(db: BusinessDb, lineId: string, qty: number, unitCost: Prisma.Decimal) {
  await db.$transaction(async (tx) => {
    const line = await tx.purchaseOrderLine.findUniqueOrThrow({ where: { id: lineId }, include: { allocations: true } });
    await draftOnly(tx, line.purchaseOrderId);
    const forOrders = line.allocations.reduce((n, a) => n + a.qty, 0);
    if (qty < forOrders) throw new OrderError(`Orders need ${forOrders} of these; take them off the orders first`);
    if (qty === 0) await tx.purchaseOrderLine.delete({ where: { id: lineId } });
    else await tx.purchaseOrderLine.update({ where: { id: lineId }, data: { qty, unitCost } });
    await repricePo(tx, line.purchaseOrderId);
  });
}

/** Remove a draft line; orders it was for need those blanks again. */
export async function removePoLine(db: BusinessDb, lineId: string, staffId: string | null) {
  await db.$transaction(async (tx) => {
    const line = await tx.purchaseOrderLine.findUniqueOrThrow({ where: { id: lineId }, include: { allocations: true, variant: { include: variantInclude }, purchaseOrder: true } });
    await draftOnly(tx, line.purchaseOrderId);
    await tx.purchaseOrderLine.delete({ where: { id: lineId } });
    for (const a of line.allocations) {
      await logEvent(tx, tx.$businessId, a.orderId, "PURCHASING", `${a.qty} × ${variantLabel(line.variant)} taken off ${poRef(line.purchaseOrder.number)}`, staffId);
    }
    await repricePo(tx, line.purchaseOrderId);
  });
}

const purchaseOrderInclude = {
  supplier: true,
  lines: { include: { variant: { include: variantInclude }, allocations: { include: { order: true } } }, orderBy: { variant: { sku: "asc" } } },
} satisfies Prisma.PurchaseOrderInclude;

/** Mark a PO sent, optionally emailing it to the supplier. Orders on it move to "blanks ordered". */
export async function sendPurchaseOrder(
  db: BusinessDb,
  purchaseOrderId: string,
  { email, staffId }: { email: boolean; staffId: string | null },
): Promise<{ status: "SENT" | "FAILED" | "LOGGED" | null }> {
  const businessId = db.$businessId;
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: purchaseOrderInclude });
  if (po.status === "CANCELLED") throw new OrderError("This purchase order is cancelled");
  if (po.lines.length === 0) throw new OrderError("Add at least one item first");
  if (email && !isValidEmail(po.supplier.email)) throw new OrderError(`Add an email address for ${po.supplier.name} on the Suppliers page first`);

  let status: "SENT" | "FAILED" | "LOGGED" | null = null;
  if (email) {
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    const content = purchaseOrderEmail({
      brand: { name: business.name, email: business.email, phone: business.phone },
      supplierName: po.supplier.name,
      poRef: poRef(po.number),
      accountNumber: po.supplier.accountNumber,
      lines: po.lines.map((l) => ({ sku: l.variant.supplierSku ?? l.variant.sku, description: variantLabel(l.variant), qty: l.qty, unitCost: l.unitCost.toFixed(2) })),
      total: po.total.toFixed(2),
      shipTo: shipToLines(po),
      blindShip: po.blindShip,
      notes: po.notes,
    });
    const result = await sendEmail(db, { ...content, to: po.supplier.email!, fromName: business.name, replyTo: business.email, purchaseOrderId: po.id });
    status = result.status;
    if (status === "FAILED") return { status };
  }
  await db.$transaction(async (tx) => {
    if (po.status === "DRAFT") await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "SENT", sentAt: new Date() } });
    const orderIds = [...new Set(po.lines.flatMap((l) => l.allocations.map((a) => a.orderId)))];
    for (const orderId of orderIds) {
      await logEvent(tx, businessId, orderId, "PURCHASING", `Blanks ordered on ${poRef(po.number)} (${po.supplier.name})${email ? ` — emailed${deliveryNote(status!)}` : ""}`, staffId);
      await moveToRole(tx, businessId, orderId, "ORDER_BLANKS_ORDERED", staffId, `${poRef(po.number)} sent`, { forwardOnly: true });
    }
  });
  return { status };
}

export const shipToLines = (po: { shipToName: string | null; shipLine1: string | null; shipLine2: string | null; shipCity: string | null; shipRegion: string | null; shipPostalCode: string | null }) =>
  [po.shipToName, po.shipLine1, po.shipLine2, [po.shipCity, [po.shipRegion, po.shipPostalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter((l): l is string => !!l);

/**
 * Record what arrived. Anything beyond what orders were waiting for goes
 * into in-house stock.
 */
export async function receivePurchaseOrder(db: BusinessDb, purchaseOrderId: string, receipts: { lineId: string; qty: number }[], staffId: string | null) {
  const businessId = db.$businessId;
  const got = receipts.filter((r) => r.qty !== 0);
  if (got.length === 0) throw new OrderError("Enter how many of each item arrived");
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: purchaseOrderInclude });
    if (po.status === "DRAFT") throw new OrderError("Send the purchase order before receiving it");
    if (po.status === "CANCELLED") throw new OrderError("This purchase order is cancelled");
    const perOrder = new Map<string, number>();
    for (const r of got) {
      const line = po.lines.find((l) => l.id === r.lineId);
      if (!line) throw new OrderError("That item isn't on this purchase order");
      const after = line.qtyReceived + r.qty;
      if (after < 0) throw new OrderError(`Can't take back more ${variantLabel(line.variant)} than were received`);
      const forOrders = line.allocations.reduce((n, a) => n + a.qty, 0);
      const extra = Math.max(0, after - forOrders) - Math.max(0, line.qtyReceived - forOrders);
      await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { qtyReceived: after } });
      if (extra !== 0) {
        const v = line.variant;
        await tx.productVariant.update({ where: { id: v.id }, data: { stockOnHand: (v.stockOnHand ?? 0) + extra } });
        v.stockOnHand = (v.stockOnHand ?? 0) + extra;
        await tx.stockMovement.create({ data: { businessId, variantId: v.id, change: extra, reason: "RECEIVED", purchaseOrderId: po.id, staffId } });
      }
      // Credit orders oldest first with what newly counts toward them.
      let before = line.qtyReceived;
      let now = after;
      for (const a of [...line.allocations].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
        const delta = Math.min(a.qty, Math.max(0, now)) - Math.min(a.qty, Math.max(0, before));
        if (delta) perOrder.set(a.orderId, (perOrder.get(a.orderId) ?? 0) + delta);
        before -= a.qty;
        now -= a.qty;
      }
    }
    const lines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId } });
    const complete = lines.every((l) => l.qtyReceived >= l.qty);
    const any = lines.some((l) => l.qtyReceived > 0);
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: complete ? "RECEIVED" : any ? "PARTIAL" : "SENT", receivedAt: complete ? new Date() : null },
    });
    for (const [orderId, n] of perOrder) {
      await logEvent(tx, businessId, orderId, "PURCHASING", `${n > 0 ? "Received" : "Un-received"} ${Math.abs(n)} blank${Math.abs(n) === 1 ? "" : "s"} on ${poRef(po.number)}`, staffId);
    }
  });
}

/** Cancel a PO that hasn't been received; its orders need those blanks again. */
export async function cancelPurchaseOrder(db: BusinessDb, purchaseOrderId: string, staffId: string | null) {
  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: purchaseOrderInclude });
    if (po.lines.some((l) => l.qtyReceived > 0)) throw new OrderError("Items have been received on this PO, so it can't be cancelled");
    const allocations = po.lines.flatMap((l) => l.allocations);
    await tx.blankAllocation.deleteMany({ where: { id: { in: allocations.map((a) => a.id) } } });
    if (po.status === "DRAFT") await tx.purchaseOrder.delete({ where: { id: po.id } });
    else await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "CANCELLED" } });
    for (const orderId of new Set(allocations.map((a) => a.orderId))) {
      await logEvent(tx, tx.$businessId, orderId, "PURCHASING", `${poRef(po.number)} ${po.status === "DRAFT" ? "deleted" : "cancelled"}; its blanks need ordering again`, staffId);
    }
  });
}

export { purchaseOrderInclude, variantInclude };

// ─── In-house stock ─────────────────────────────────────────────────────

/** Start (or stop) counting a variant's stock. */
export async function trackStock(db: BusinessDb, sku: string) {
  const v = await db.productVariant.findFirst({ where: { OR: [{ sku }, { supplierSku: sku }] } });
  if (!v) throw new OrderError(`No product has SKU ${sku}`);
  if (v.stockOnHand !== null) throw new OrderError(`${v.sku} is already tracked`);
  await db.productVariant.update({ where: { id: v.id }, data: { stockOnHand: 0 } });
  return v;
}

export async function stopTracking(db: BusinessDb, variantId: string) {
  const v = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  if ((v.stockOnHand ?? 0) !== 0) throw new OrderError("Set the count to 0 before you stop tracking it");
  await db.productVariant.update({ where: { id: variantId }, data: { stockOnHand: null, reorderPoint: null } });
}

/** Set the counted quantity and the low-stock level. */
export async function setStock(db: BusinessDb, variantId: string, counted: number, reorderPoint: number | null, note: string | null, staffId: string | null) {
  await db.$transaction(async (tx) => {
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const change = counted - (v.stockOnHand ?? 0);
    await tx.productVariant.update({ where: { id: variantId }, data: { stockOnHand: counted, reorderPoint } });
    if (change) await tx.stockMovement.create({ data: { businessId: tx.$businessId, variantId, change, reason: "ADJUSTED", note, staffId } });
  });
}

