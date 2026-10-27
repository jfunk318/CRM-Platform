import "server-only";
import { type BusinessDb, forBusiness, prisma } from "@/lib/db";
import { orderRef } from "@/lib/orders/numbers";
import { repriceOrder } from "@/lib/orders/pricing";
import { createOrder, logEvent, moveToRole, OrderError } from "@/lib/orders/service";
import { createProductionJobs } from "@/lib/production/jobs";

/** A store's orders waiting for its batch. */
export const heldOrdersWhere = (storeId: string) => ({ storeId, heldForBatch: true, type: "ORDER" as const, status: { isClosed: false } });

/**
 * Combine a store's held orders into one production order for the store's
 * customer: one line per design with the sizes added up and every name and
 * number on its roster. Its lines carry no price (the shoppers paid on their
 * own orders). The batch order gets production jobs and buys the blanks; the
 * shoppers' orders move to In production and point at it.
 */
export async function batchStoreOrders(db: BusinessDb, storeId: string, staffId: string | null): Promise<{ batchId: string; orderId: string; orders: number; pieces: number }> {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  if (!store.customerId) throw new OrderError("Set the store's customer (Settings) first; the batch order is made for them");
  const held = await db.order.findMany({
    where: heldOrdersWhere(storeId),
    orderBy: { number: "asc" },
    include: { lines: { orderBy: { sortOrder: "asc" }, include: { sizes: true, names: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (held.length === 0) throw new OrderError("No orders are waiting for this store's batch");

  // Same design → one line; sizes summed, rosters joined.
  const byDesign = new Map<string, { storeItemId: string | null; sizes: Map<string, number>; names: { sizeId: string; name: string; number: string; qty: number }[]; from: Set<number> }>();
  for (const order of held) {
    for (const line of order.lines) {
      const g = byDesign.get(line.designId) ?? { storeItemId: line.storeItemId, sizes: new Map<string, number>(), names: [] as { sizeId: string; name: string; number: string; qty: number }[], from: new Set<number>() };
      for (const s of line.sizes) g.sizes.set(s.sizeId, (g.sizes.get(s.sizeId) ?? 0) + s.qty);
      for (const n of line.names) g.names.push({ sizeId: n.sizeId, name: n.name, number: n.number, qty: n.qty });
      g.from.add(order.number);
      byDesign.set(line.designId, g);
    }
  }
  const pieces = [...byDesign.values()].reduce((n, g) => n + [...g.sizes.values()].reduce((a, b) => a + b, 0), 0);

  const number = (await db.storeBatch.count({ where: { storeId } })) + 1;
  const orderId = await createOrder(db, { type: "ORDER", customerId: store.customerId, staffId, title: `${store.name} batch ${number}` });
  const businessId = db.$businessId;
  const batchId = await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { source: "STORE_BATCH", storeId, approvedAt: new Date(), approvedByName: "Store orders" } });
    let sortOrder = 0;
    for (const [designId, g] of byDesign) {
      await tx.orderLine.create({
        data: {
          businessId,
          orderId,
          designId,
          storeItemId: g.storeItemId,
          fixedPrice: true,
          notes: `From order${g.from.size === 1 ? "" : "s"} ${[...g.from].map((n) => `#${n}`).join(", ")}`,
          sortOrder: sortOrder++,
          sizes: { create: [...g.sizes].map(([sizeId, qty]) => ({ sizeId, qty, unitPrice: 0, total: 0 })) },
          names: { create: g.names.map((n, i) => ({ ...n, sortOrder: i })) },
        },
      });
    }
    const batch = await tx.storeBatch.create({ data: { businessId, storeId, number, orderId, createdById: staffId } });
    const batchOrder = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    await tx.order.updateMany({ where: { id: { in: held.map((o) => o.id) } }, data: { heldForBatch: false, batchId: batch.id } });
    for (const o of held) {
      await logEvent(tx, businessId, o.id, "PRODUCTION", `In ${store.name} batch ${number} (order ${orderRef(batchOrder)})`, staffId);
      await moveToRole(tx, businessId, o.id, "ORDER_IN_PRODUCTION", staffId, `batched into order ${orderRef(batchOrder)}`, { forwardOnly: true });
    }
    await logEvent(tx, businessId, orderId, "STORE", `${store.name} batch ${number}: ${held.length} order${held.length === 1 ? "" : "s"}, ${pieces} pieces`, staffId);
    return batch.id;
  });
  await repriceOrder(db, orderId);
  await createProductionJobs(db, orderId, staffId).catch((e) => {
    if (!(e instanceof OrderError)) throw e;
  });
  return { batchId, orderId, orders: held.length, pieces };
}

/**
 * Batch every closed store that holds orders, across all businesses. Run it
 * on a schedule (hourly is plenty): see `/api/cron/hourly`.
 */
export async function runDueBatches(now = new Date()): Promise<{ store: string; orders: number; error?: string }[]> {
  const due = await prisma.store.findMany({
    where: { batchOrders: true, closesAt: { lte: now }, business: { status: "ACTIVE" }, orders: { some: { heldForBatch: true, status: { isClosed: false } } } },
    select: { id: true, name: true, businessId: true },
  });
  const out: { store: string; orders: number; error?: string }[] = [];
  for (const s of due) {
    try {
      const r = await batchStoreOrders(forBusiness(s.businessId), s.id, null);
      out.push({ store: s.name, orders: r.orders });
    } catch (e) {
      if (!(e instanceof OrderError)) throw e;
      out.push({ store: s.name, orders: 0, error: e.message });
    }
  }
  return out;
}
