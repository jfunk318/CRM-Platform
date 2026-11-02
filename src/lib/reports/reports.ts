import "server-only";
import { Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { visitStats } from "@/lib/store/visits";

// Reports for the back office's Reporting section: sales, production and
// stores, over a chosen period compared with the one before it.

const DAY = 86_400_000;
export const PERIODS = [30, 90, 365] as const;
export type Period = (typeof PERIODS)[number];

export const periodFrom = (v: string | undefined): Period => (PERIODS.find((p) => String(p) === v) ?? 90) as Period;

/** The last `days` days up to now, and the same length just before it. */
export function rangeOf(days: number, now = new Date()) {
  const to = now;
  const from = new Date(to.getTime() - days * DAY);
  const prevFrom = new Date(from.getTime() - days * DAY);
  return { days, from, to, prevFrom };
}
export type Range = ReturnType<typeof rangeOf>;

/** Cancelled = closed without being completed (and not a quote that became an order). */
const notCancelled = { NOT: { status: { isClosed: true, OR: [{ role: null }, { role: { notIn: ["ORDER_FULFILLED", "QUOTE_CONVERTED"] } }] } } } satisfies Prisma.OrderWhereInput;

/** Real orders: store batches repeat the store's own orders for production, so they're left out. */
const realOrders = { type: "ORDER", source: { not: "STORE_BATCH" }, ...notCancelled } satisfies Prisma.OrderWhereInput;

const num = (d: Prisma.Decimal | null | undefined) => (d ? Number(d) : 0);
const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((t, r) => t + f(r), 0);

/** Change from the period before, as a fraction (null when there's nothing to compare with). */
export const change = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

/** Month labels and their first instants, oldest first, ending with this month. */
export function lastMonths(count: number, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1));
    return { start, label: start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), key: start.toISOString().slice(0, 7) };
  });
}

export async function salesReport(db: BusinessDb, r: Range, now = new Date()) {
  const months = lastMonths(12, now);
  const [orders, prevOrders, yearOrders, payments, prevPayments, quotes, open] = await Promise.all([
    db.order.findMany({ where: { ...realOrders, createdAt: { gte: r.from, lte: r.to } }, select: { total: true, source: true, customerId: true, customer: { select: { firstName: true, lastName: true, company: { select: { name: true } } } } } }),
    db.order.findMany({ where: { ...realOrders, createdAt: { gte: r.prevFrom, lt: r.from } }, select: { total: true } }),
    db.order.findMany({ where: { ...realOrders, createdAt: { gte: months[0].start } }, select: { total: true, createdAt: true } }),
    db.payment.findMany({ where: { receivedAt: { gte: r.from, lte: r.to } }, select: { amount: true } }),
    db.payment.findMany({ where: { receivedAt: { gte: r.prevFrom, lt: r.from } }, select: { amount: true } }),
    db.order.findMany({ where: { type: "QUOTE", createdAt: { gte: r.from, lte: r.to } }, select: { total: true, convertedTo: { select: { id: true } } } }),
    db.order.findMany({ where: { ...realOrders, status: { isClosed: false } }, select: { total: true, paidTotal: true } }),
  ]);

  const booked = sum(orders, (o) => num(o.total));
  const prevBooked = sum(prevOrders, (o) => num(o.total));
  const received = sum(payments, (p) => num(p.amount));
  const won = quotes.filter((q) => q.convertedTo);

  const byMonth = new Map(months.map((m) => [m.key, 0]));
  for (const o of yearOrders) {
    const key = o.createdAt.toISOString().slice(0, 7);
    if (byMonth.has(key)) byMonth.set(key, byMonth.get(key)! + num(o.total));
  }

  const customers = new Map<string, { id: string; name: string; company: string | null; total: number; orders: number }>();
  for (const o of orders) {
    const c = customers.get(o.customerId) ?? { id: o.customerId, name: `${o.customer.firstName} ${o.customer.lastName}`.trim(), company: o.customer.company?.name ?? null, total: 0, orders: 0 };
    c.total += num(o.total);
    c.orders++;
    customers.set(o.customerId, c);
  }

  const sources = new Map<string, { orders: number; total: number }>();
  for (const o of orders) {
    const s = sources.get(o.source) ?? { orders: 0, total: 0 };
    s.orders++;
    s.total += num(o.total);
    sources.set(o.source, s);
  }

  const owing = open.filter((o) => num(o.total) - num(o.paidTotal) > 0.005);
  return {
    booked,
    bookedChange: change(booked, prevBooked),
    orders: orders.length,
    ordersChange: change(orders.length, prevOrders.length),
    average: orders.length ? booked / orders.length : 0,
    received,
    receivedChange: change(received, sum(prevPayments, (p) => num(p.amount))),
    quotes: quotes.length,
    quotesWon: won.length,
    winRate: quotes.length ? won.length / quotes.length : null,
    quotedValue: sum(quotes, (q) => num(q.total)),
    months: months.map((m) => ({ label: m.label, key: m.key, total: byMonth.get(m.key)! })),
    topCustomers: [...customers.values()].sort((a, b) => b.total - a.total).slice(0, 8),
    sources: [...sources.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.total - a.total),
    outstanding: sum(owing, (o) => num(o.total) - num(o.paidTotal)),
    outstandingOrders: owing.length,
  };
}

/** Whole days between two instants. */
const daysBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / DAY);
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

export async function productionReport(db: BusinessDb, r: Range, now = new Date()) {
  const weeks = 12;
  const weekStart = new Date(now.getTime() - weeks * 7 * DAY);
  const [done, prevDone, recent, openJobs] = await Promise.all([
    db.productionJob.findMany({ where: { status: "DONE", completedAt: { gte: r.from, lte: r.to } }, select: { createdAt: true, completedAt: true, method: { select: { name: true } }, order: { select: { dueDate: true } } } }),
    db.productionJob.count({ where: { status: "DONE", completedAt: { gte: r.prevFrom, lt: r.from } } }),
    db.productionJob.findMany({ where: { status: "DONE", completedAt: { gte: weekStart } }, select: { completedAt: true } }),
    db.productionJob.findMany({ where: { status: { not: "DONE" } }, select: { status: true, order: { select: { dueDate: true } } } }),
  ]);

  const withDue = done.filter((j) => j.order.dueDate);
  const onTime = withDue.filter((j) => dateOnly(j.completedAt!) <= dateOnly(j.order.dueDate!));
  const turnaround = done.length ? sum(done, (j) => daysBetween(j.createdAt, j.completedAt!)) / done.length : null;

  const methods = new Map<string, { done: number; onTime: number; withDue: number }>();
  for (const j of done) {
    const m = methods.get(j.method.name) ?? { done: 0, onTime: 0, withDue: 0 };
    m.done++;
    if (j.order.dueDate) {
      m.withDue++;
      if (dateOnly(j.completedAt!) <= dateOnly(j.order.dueDate)) m.onTime++;
    }
    methods.set(j.method.name, m);
  }

  // Jobs finished each week, oldest first, ending with this week.
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(weekStart.getTime() + i * 7 * DAY);
    return { label: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), count: 0 };
  });
  for (const j of recent) {
    const i = Math.min(weeks - 1, Math.floor((j.completedAt!.getTime() - weekStart.getTime()) / (7 * DAY)));
    if (i >= 0) weekly[i].count++;
  }

  const today = dateOnly(now);
  return {
    done: done.length,
    doneChange: change(done.length, prevDone),
    onTimeRate: withDue.length ? onTime.length / withDue.length : null,
    turnaround,
    queued: openJobs.filter((j) => j.status === "QUEUED").length,
    inProgress: openJobs.filter((j) => j.status === "IN_PROGRESS").length,
    late: openJobs.filter((j) => j.order.dueDate && dateOnly(j.order.dueDate) < today).length,
    methods: [...methods.entries()].map(([name, m]) => ({ name, ...m, onTimeRate: m.withDue ? m.onTime / m.withDue : null })).sort((a, b) => b.done - a.done),
    weekly,
  };
}

export async function storesReport(db: BusinessDb, r: Range, now = new Date()) {
  const [stores, orders, prevOrders, payouts] = await Promise.all([
    db.store.findMany({ where: { kind: "AFFILIATE" }, select: { id: true, name: true } }),
    db.order.findMany({ where: { ...realOrders, source: "STOREFRONT", placedAt: { gte: r.from, lte: r.to } }, select: { storeId: true, total: true, commission: true, paidTotal: true } }),
    db.order.findMany({ where: { ...realOrders, source: "STOREFRONT", placedAt: { gte: r.prevFrom, lt: r.from } }, select: { total: true } }),
    db.commissionPayout.findMany({ select: { storeId: true, amount: true } }),
  ]);
  // Commission is earned once an order is paid in full; owed = earned − paid out (all time).
  const earnedOrders = await db.order.findMany({ where: { ...realOrders, source: "STOREFRONT", commission: { gt: 0 } }, select: { storeId: true, total: true, paidTotal: true, commission: true } });
  const visits = await visitStats(db, stores.map((s) => s.id), Math.min(r.days, 365), now);

  const rows = stores.map((s) => {
    const mine = orders.filter((o) => o.storeId === s.id);
    const earned = sum(earnedOrders.filter((o) => o.storeId === s.id && num(o.paidTotal) >= num(o.total)), (o) => num(o.commission));
    const paidOut = sum(payouts.filter((p) => p.storeId === s.id), (p) => num(p.amount));
    const v = visits.get(s.id)?.visits ?? 0;
    return {
      id: s.id,
      name: s.name,
      orders: mine.length,
      sales: sum(mine, (o) => num(o.total)),
      commission: sum(mine, (o) => num(o.commission)),
      visits: v,
      conversion: v ? mine.length / v : null,
      owed: Math.max(0, earned - paidOut),
    };
  });
  // Everything bought online: affiliate stores and the main site.
  const sales = sum(orders, (o) => num(o.total));
  const mainSite = orders.filter((o) => !stores.some((s) => s.id === o.storeId));
  return {
    sales,
    salesChange: change(sales, sum(prevOrders, (o) => num(o.total))),
    orders: orders.length,
    mainSiteSales: sum(mainSite, (o) => num(o.total)),
    mainSiteOrders: mainSite.length,
    commission: sum(rows, (s) => s.commission),
    owed: sum(rows, (s) => s.owed),
    visits: sum(rows, (s) => s.visits),
    activeStores: rows.filter((s) => s.orders > 0).length,
    stores: rows.filter((s) => s.orders > 0 || s.visits > 0 || s.owed > 0).sort((a, b) => b.sales - a.sales),
  };
}
