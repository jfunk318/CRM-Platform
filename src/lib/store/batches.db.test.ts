// Store orders held until the store closes, then produced as one batch order.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setUpBusiness } from "@/lib/platform/setup";
import { blankNeeds } from "@/lib/purchasing/service";
import { makeTestBusiness } from "@/test/fixtures";
import { batchStoreOrders, runDueBatches } from "./batches";
import { placeOrderFromCart } from "./checkout";
import { createStoreItem } from "./items";
import { createAffiliateStore } from "./stores";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let storeId = "";
let itemId = "";
let M = "";

beforeAll(async () => {
  t = await makeTestBusiness(`batch-${Date.now()}`);
  await setUpBusiness(t.db);
  M = t.product.sizes[0].id;
  const store = await createAffiliateStore(t.db, { name: "Lincoln Hockey", slug: `lincoln-${Date.now()}`, customerId: t.customer.id });
  storeId = store.id;
  await t.db.store.update({ where: { id: storeId }, data: { batchOrders: true, closesAt: new Date(Date.now() + 86_400_000) } });
  itemId = await createStoreItem(t.db, storeId, {
    name: "Hoodie",
    description: null,
    productId: t.product.id,
    colorId: t.product.colors[0].id,
    sizeIds: [M],
    decorations: [{ methodId: t.method.id, location: "Front", colors: 1 }],
    batchQty: 24,
  });
  await t.db.storeItem.update({ where: { id: itemId }, data: { nameMode: "OPTIONAL" } });
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

async function shop(email: string, items: { qty: number; name?: string }[]) {
  const pickup = await t.db.deliveryMethod.findFirstOrThrow({ where: { kind: "PICKUP" } });
  const cart = await t.db.cart.create({
    data: {
      businessId: t.business.id,
      storeId,
      tokenHash: `${email}-${Date.now()}`,
      email,
      firstName: email.split("@")[0],
      lastName: "Parent",
      deliveryMethodId: pickup.id,
      items: { create: items.map((i) => ({ storeItemId: itemId, sizeId: M, qty: i.qty, name: i.name ?? "" })) },
    },
  });
  return placeOrderFromCart(t.db, cart.id, null, "http://lincoln.localhost:3000");
}

describe("batching a store's orders", () => {
  const orderIds: string[] = [];

  it("holds orders placed while the store batches: no production jobs, no blanks to buy yet", async () => {
    orderIds.push((await shop("ana@example.com", [{ qty: 2, name: "Ana" }])).id, (await shop("ben@example.com", [{ qty: 1 }, { qty: 1, name: "Ben" }])).id);
    const orders = await t.db.order.findMany({ where: { id: { in: orderIds } }, include: { productionJobs: true } });
    expect(orders.map((o) => [o.heldForBatch, o.productionJobs.length])).toEqual([
      [true, 0],
      [true, 0],
    ]);
    expect((await blankNeeds(t.db)).filter((n) => orderIds.includes(n.order.id))).toEqual([]);
  });

  it("combines them into one order for the store's customer, with sizes added up and every name", async () => {
    const r = await batchStoreOrders(t.db, storeId, t.staff.id);
    expect(r).toMatchObject({ orders: 2, pieces: 4 });
    const batch = await t.db.order.findUniqueOrThrow({
      where: { id: r.orderId },
      include: { lines: { include: { sizes: true, names: { orderBy: { sortOrder: "asc" } } } }, productionJobs: true, producesBatch: true },
    });
    expect(batch).toMatchObject({ source: "STORE_BATCH", storeId, customerId: t.customer.id, title: "Lincoln Hockey batch 1" });
    expect(batch.producesBatch?.number).toBe(1);
    expect(batch.lines).toHaveLength(1);
    expect(batch.lines[0].sizes.map((s) => [s.sizeId, s.qty])).toEqual([[M, 4]]);
    expect(batch.lines[0].names.map((n) => [n.name, n.qty])).toEqual([
      ["Ana", 2],
      ["Ben", 1],
    ]);
    // No price on the batch: the shoppers paid on their own orders.
    expect(batch.total.toFixed(2)).toBe("0.00");
    expect(batch.productionJobs).toHaveLength(1);
    // The batch order is what needs blanks now.
    expect((await blankNeeds(t.db)).map((n) => n.order.id)).toContain(batch.id);

    const shoppers = await t.db.order.findMany({ where: { id: { in: orderIds } }, include: { status: true } });
    for (const o of shoppers) expect([o.heldForBatch, o.batchId, o.status.role]).toEqual([false, r.batchId, "ORDER_IN_PRODUCTION"]);
    await expect(batchStoreOrders(t.db, storeId, t.staff.id)).rejects.toThrow(/No orders are waiting/);
  });

  it("batches closed stores on schedule, and leaves open ones alone", async () => {
    await shop("cy@example.com", [{ qty: 3 }]);
    expect((await runDueBatches()).find((b) => b.store === "Lincoln Hockey")).toBeUndefined();
    await t.db.store.update({ where: { id: storeId }, data: { closesAt: new Date(Date.now() - 60_000) } });
    expect((await runDueBatches()).find((b) => b.store === "Lincoln Hockey")).toEqual({ store: "Lincoln Hockey", orders: 1 });
    expect(await t.db.storeBatch.count({ where: { storeId } })).toBe(2);
  });

  it("needs the store's customer", async () => {
    await t.db.store.update({ where: { id: storeId }, data: { customerId: null } });
    await expect(batchStoreOrders(t.db, storeId, null)).rejects.toThrow(/store's customer/);
  });
});
