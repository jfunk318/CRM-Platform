// Production jobs, purchasing and shipping, against the database in
// DATABASE_URL, inside throwaway businesses.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { addLine, createOrder, updateLine } from "@/lib/orders/service";
import { autoSchedule, createProductionJobs, setStepDone } from "@/lib/production/jobs";
import {
  blankNeeds,
  cancelPurchaseOrder,
  markBlanksSupplied,
  orderBlanks,
  orderBlankStatus,
  receivePurchaseOrder,
  releaseAllocation,
  sendPurchaseOrder,
  setStock,
} from "@/lib/purchasing/service";
import { createShipment, deleteShipment, shipmentProgress, shippingOrderInclude } from "@/lib/shipping/service";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let other: Awaited<ReturnType<typeof makeTestBusiness>>;
const origin = "http://shop.localhost:3000";

beforeAll(async () => {
  t = await makeTestBusiness(`ful-${Date.now()}`);
  other = await makeTestBusiness(`ful-other-${Date.now()}`);
  const supplier = await t.db.supplier.create({ data: { businessId: t.business.id, code: "sanmar", name: "SanMar", email: "orders@sanmar.example" } });
  await t.db.product.update({ where: { id: t.product.id }, data: { supplierId: supplier.id } });
});
afterAll(async () => {
  await t.cleanup();
  await other.cleanup();
  await prisma.$disconnect();
});

const statusName = async (orderId: string) => (await t.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { status: true } })).status.name;
const newOrder = async (qty: number) => {
  const id = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
  await addLine(t.db, id, t.line(qty), t.staff.id);
  return id;
};

describe("production", () => {
  let orderId = "";
  beforeAll(async () => {
    orderId = await newOrder(24);
  });

  it("creates one job per method with the default steps, once", async () => {
    expect(await createProductionJobs(t.db, orderId, t.staff.id)).toBe(1);
    expect(await createProductionJobs(t.db, orderId, t.staff.id)).toBe(0);
    const job = await t.db.productionJob.findFirstOrThrow({ where: { orderId }, include: { steps: { orderBy: { sortOrder: "asc" } } } });
    expect(job.steps.map((s) => s.name)).toEqual(["Films & screens", "Press setup", "Print", "Cure", "Fold & pack"]);
    expect(await other.db.productionJob.count()).toBe(0);
  });

  it("uses the method's own workflow when it has one", async () => {
    await t.db.workflowStep.createMany({ data: ["Burn", "Print", "Pack"].map((name, i) => ({ businessId: t.business.id, methodId: t.method.id, name, sortOrder: i })) });
    const id = await newOrder(12);
    await createProductionJobs(t.db, id, null);
    const job = await t.db.productionJob.findFirstOrThrow({ where: { orderId: id }, include: { steps: { orderBy: { sortOrder: "asc" } } } });
    expect(job.steps.map((s) => s.name)).toEqual(["Burn", "Print", "Pack"]);
  });

  it("moves the order to In production, then Ready when every step is done", async () => {
    const job = await t.db.productionJob.findFirstOrThrow({ where: { orderId }, include: { steps: { orderBy: { sortOrder: "asc" } } } });
    await setStepDone(t.db, job.steps[0].id, true, t.staff.id);
    expect((await t.db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("IN_PROGRESS");
    expect(await statusName(orderId)).toBe("In production");
    for (const s of job.steps) await setStepDone(t.db, s.id, true, t.staff.id);
    expect((await t.db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("DONE");
    expect(await statusName(orderId)).toBe("Ready for pickup / shipping");
    // Undoing a step reopens the job but doesn't move the order backwards.
    await setStepDone(t.db, job.steps[4].id, false, t.staff.id);
    expect((await t.db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("IN_PROGRESS");
    expect(await statusName(orderId)).toBe("Ready for pickup / shipping");
  });

  it("auto-schedules by due date within the method's daily capacity", async () => {
    await t.db.productionJob.updateMany({ data: { scheduledFor: null } });
    await t.db.decorationMethod.update({ where: { id: t.method.id }, data: { dailyCapacity: 30 } });
    const monday = new Date("2026-11-02T00:00:00Z");
    expect(await autoSchedule(t.db, null, monday)).toBe(2);
    const jobs = await t.db.productionJob.findMany({ include: { order: true }, orderBy: { scheduledFor: "asc" } });
    // 24 + 12 pieces don't fit in 30 a day, so the second job goes to Tuesday.
    expect(jobs.map((j) => j.scheduledFor?.toISOString().slice(0, 10))).toEqual(["2026-11-02", "2026-11-03"]);
  });
});

describe("purchasing", () => {
  let a = "";
  let b = "";
  let variantId = "";
  beforeAll(async () => {
    await t.db.order.updateMany({ data: { statusId: (await t.db.orderStatus.findFirstOrThrow({ where: { name: "Completed" } })).id } });
    a = await newOrder(12);
    b = await newOrder(20);
    variantId = (await t.db.productVariant.findFirstOrThrow()).id;
    await setStock(t.db, variantId, 5, 2, "count", t.staff.id);
  });

  it("works out what open orders need", async () => {
    const needs = await blankNeeds(t.db);
    expect(needs.map((n) => n.rows.map((r) => [r.needed, r.short]))).toEqual([[[12, 12]], [[20, 20]]]);
  });

  it("uses stock first, then consolidates orders onto one draft PO per supplier", async () => {
    const r = await orderBlanks(t.db, [`${a}:${variantId}`, `${b}:${variantId}`], { useStock: true, staffId: t.staff.id });
    expect(r).toEqual({ purchaseOrders: 1, fromStock: 5, onOrder: 27 });
    expect((await t.db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockOnHand).toBe(0);
    const po = await t.db.purchaseOrder.findFirstOrThrow({ include: { lines: true } });
    expect(po.status).toBe("DRAFT");
    expect(po.lines.map((l) => l.qty)).toEqual([27]);
    expect(po.total.toFixed(2)).toBe("135.00");
    expect((await blankNeeds(t.db)).every((n) => n.rows.every((r) => r.short === 0))).toBe(true);
    await expect(orderBlanks(t.db, [`${a}:${variantId}`], { useStock: true, staffId: null })).rejects.toThrow(/already covered/);
  });

  it("returns stock and shrinks the draft PO when an allocation is released", async () => {
    const stock = await t.db.blankAllocation.findFirstOrThrow({ where: { orderId: a, source: "STOCK" } });
    await releaseAllocation(t.db, stock.id, t.staff.id);
    expect((await t.db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockOnHand).toBe(5);
    const onPo = await t.db.blankAllocation.findFirstOrThrow({ where: { orderId: b, source: "PO" } });
    await releaseAllocation(t.db, onPo.id, t.staff.id);
    expect((await t.db.purchaseOrderLine.findFirstOrThrow()).qty).toBe(7);
    // Put them back: a needs 5, b needs 20.
    await orderBlanks(t.db, [`${a}:${variantId}`, `${b}:${variantId}`], { useStock: false, staffId: null });
    expect((await t.db.purchaseOrderLine.findFirstOrThrow()).qty).toBe(32);
  });

  it("sends the PO and moves its orders to Ordering blanks", async () => {
    const po = await t.db.purchaseOrder.findFirstOrThrow();
    const r = await sendPurchaseOrder(t.db, po.id, { email: true, staffId: t.staff.id });
    expect(r.status).toBe("LOGGED");
    expect((await t.db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("SENT");
    expect(await statusName(a)).toBe("Ordering blanks");
    const email = await t.db.emailMessage.findFirstOrThrow({ where: { purchaseOrderId: po.id } });
    expect(email.to).toBe("orders@sanmar.example");
    expect(email.html).toContain("T1-NAVY-M");
    const sent = await t.db.blankAllocation.findFirstOrThrow({ where: { orderId: b, source: "PO" } });
    await expect(releaseAllocation(t.db, sent.id, null)).rejects.toThrow(/has been sent/);
  });

  it("receives in parts, crediting the oldest orders first, and puts extras in stock", async () => {
    const po = await t.db.purchaseOrder.findFirstOrThrow({ include: { lines: true } });
    await receivePurchaseOrder(t.db, po.id, [{ lineId: po.lines[0].id, qty: 10 }], t.staff.id);
    expect((await t.db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("PARTIAL");
    const sa = await orderBlankStatus(t.db, a);
    const sb = await orderBlankStatus(t.db, b);
    // a's allocations are older than b's, so a fills first.
    expect(sa.rows[0].inHand).toBe(10);
    expect(sb.rows[0].inHand).toBe(0);
    expect(sa.ready).toBe(false);
    await receivePurchaseOrder(t.db, po.id, [{ lineId: po.lines[0].id, qty: 25 }], t.staff.id);
    expect((await t.db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("RECEIVED");
    expect((await orderBlankStatus(t.db, a)).ready).toBe(true);
    expect((await orderBlankStatus(t.db, b)).ready).toBe(true);
    // 35 arrived for 32 on order: 3 extra go to stock (5 + 3).
    expect((await t.db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockOnHand).toBe(8);
    await expect(cancelPurchaseOrder(t.db, po.id, null)).rejects.toThrow(/received/);
  });

  it("can mark blanks as supplied by the customer", async () => {
    const c = await newOrder(12);
    await markBlanksSupplied(t.db, `${c}:${variantId}`, "Customer dropping off", t.staff.id);
    expect((await orderBlankStatus(t.db, c)).ready).toBe(true);
  });

  it("cancelling a sent PO frees its orders to be ordered again", async () => {
    const d = await newOrder(12);
    await orderBlanks(t.db, [`${d}:${variantId}`], { useStock: false, staffId: null });
    const po = await t.db.purchaseOrder.findFirstOrThrow({ where: { status: "DRAFT" } });
    await sendPurchaseOrder(t.db, po.id, { email: false, staffId: null });
    await cancelPurchaseOrder(t.db, po.id, null);
    expect((await t.db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("CANCELLED");
    expect((await blankNeeds(t.db, [d]))[0].rows[0].short).toBe(12);
  });
});

describe("shipping", () => {
  let orderId = "";
  beforeAll(async () => {
    orderId = await newOrder(12);
  });
  const progress = async () => shipmentProgress(await t.db.order.findUniqueOrThrow({ where: { id: orderId }, include: shippingOrderInclude }));

  it("ships part of an order, then the rest, and completes it", async () => {
    const line = (await progress()).rows[0];
    await expect(
      createShipment(t.db, orderId, { kind: "SHIP", deliveryMethodId: null, carrier: "ups", trackingNumber: "1Z1", cost: null, note: null, items: [{ lineId: line.lineId, sizeId: line.sizeId, qty: 13 }], notify: false, origin }, null),
    ).rejects.toThrow(/Only 12/);
    const first = await createShipment(
      t.db,
      orderId,
      { kind: "SHIP", deliveryMethodId: null, carrier: "ups", trackingNumber: "1Z1", cost: null, note: null, items: [{ lineId: line.lineId, sizeId: line.sizeId, qty: 5 }], notify: true, origin },
      t.staff.id,
    );
    expect(first.emailStatus).toBe("LOGGED");
    expect((await progress()).remaining).toBe(7);
    expect(await statusName(orderId)).not.toBe("Completed");
    await createShipment(
      t.db,
      orderId,
      { kind: "PICKUP", deliveryMethodId: null, carrier: null, trackingNumber: null, cost: null, note: "Pat", items: [{ lineId: line.lineId, sizeId: line.sizeId, qty: 7 }], notify: false, origin },
      t.staff.id,
    );
    expect((await progress()).complete).toBe(true);
    expect(await statusName(orderId)).toBe("Completed");
    const email = await t.db.emailMessage.findFirstOrThrow({ where: { orderId, subject: { contains: "shipped" } } });
    expect(email.html).toContain("ups.com/track?tracknum=1Z1");
  });

  it("keeps shipment history when a line is edited, and frees quantity when a shipment is deleted", async () => {
    const line = (await progress()).rows[0];
    await updateLine(t.db, line.lineId, t.line(12), t.staff.id);
    expect((await progress()).remaining).toBe(0);
    const sh = await t.db.shipment.findFirstOrThrow({ where: { orderId, kind: "PICKUP" } });
    await deleteShipment(t.db, sh.id, null);
    expect((await progress()).remaining).toBe(7);
  });
});
