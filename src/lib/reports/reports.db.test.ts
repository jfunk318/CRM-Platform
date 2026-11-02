// The Reporting section's numbers: sales, production and stores.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/service";
import { makeTestBusiness } from "@/test/fixtures";
import { change, lastMonths, productionReport, rangeOf, salesReport } from "./reports";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`reports-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const DAY = 86_400_000;
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * DAY);

async function order(total: number, createdAt: Date, extra: Prisma.OrderUpdateInput = {}) {
  const id = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
  await t.db.order.update({ where: { id }, data: { total: new Prisma.Decimal(total), createdAt, ...extra } });
  return id;
}

describe("periods", () => {
  it("compare with the period before and list the last months", () => {
    expect(change(150, 100)).toBeCloseTo(0.5);
    expect(change(5, 0)).toBeNull();
    const r = rangeOf(30, now);
    expect(r.from.getTime() - r.prevFrom.getTime()).toBe(30 * DAY);
    const months = lastMonths(12, new Date("2026-03-15T12:00:00Z"));
    expect(months).toHaveLength(12);
    expect(months.at(-1)!.key).toBe("2026-03");
    expect(months[0].key).toBe("2025-04");
  });
});

describe("the sales report", () => {
  it("counts booked orders and payments in the period, leaves out cancelled orders and works out the quote win rate", async () => {
    const a = await order(1000, ago(5));
    await order(500, ago(10), { paidTotal: new Prisma.Decimal(500) });
    await order(300, ago(40)); // the period before
    const cancelled = await t.db.orderStatus.create({ data: { businessId: t.business.id, type: "ORDER", name: "Voided (test)", isClosed: true } });
    await order(9999, ago(3), { status: { connect: { businessId_id: { businessId: t.business.id, id: cancelled.id } } } });
    await t.db.payment.create({ data: { businessId: t.business.id, orderId: a, amount: new Prisma.Decimal(250), method: "CASH", receivedAt: ago(2) } });

    const won = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: null });
    // Converted: an order points back at it.
    const fromQuote = await order(0, ago(1));
    await t.db.order.update({ where: { id: fromQuote }, data: { quoteId: won } });
    await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: null });

    const r = await salesReport(t.db, rangeOf(30, new Date(Date.now() + 1000)));
    // The converted quote's order (total 0) counts as an order too.
    expect(r.booked).toBe(1500);
    expect(r.orders).toBe(3);
    expect(r.bookedChange).toBeCloseTo(4); // 1500 vs 300
    expect(r.received).toBe(250);
    expect(r.quotes).toBe(2);
    expect(r.quotesWon).toBe(1);
    expect(r.winRate).toBe(0.5);
    expect(r.topCustomers[0]).toMatchObject({ total: 1500, orders: 3 });
    expect(r.months.reduce((n, m) => n + m.total, 0)).toBe(1800);
    // Owed: 1000 + 300 still unpaid (the 250 payment isn't applied to paidTotal here).
    expect(r.outstanding).toBe(1300);
  });
});

describe("the production report", () => {
  it("counts finished jobs, how many made the due date, and what's open", async () => {
    const early = await order(10, ago(20), { dueDate: ago(1) });
    const late = await order(10, ago(20), { dueDate: ago(9) });
    const open = await order(10, ago(2), { dueDate: ago(1) });
    const job = (orderId: string, data: Partial<Prisma.ProductionJobUncheckedCreateInput>) =>
      t.db.productionJob.create({ data: { businessId: t.business.id, orderId, methodId: t.method.id, ...data } });
    await job(early, { status: "DONE", createdAt: ago(6), completedAt: ago(2) });
    await job(late, { status: "DONE", createdAt: ago(10), completedAt: ago(4) });
    await job(open, { status: "QUEUED" });

    const r = await productionReport(t.db, rangeOf(30, new Date(Date.now() + 1000)));
    expect(r.done).toBe(2);
    expect(r.onTimeRate).toBe(0.5);
    expect(r.turnaround).toBeCloseTo(5, 0);
    expect(r.queued).toBe(1);
    expect(r.late).toBe(1);
    expect(r.methods[0]).toMatchObject({ done: 2, onTimeRate: 0.5 });
    expect(r.weekly.reduce((n, w) => n + w.count, 0)).toBe(2);
  });
});
