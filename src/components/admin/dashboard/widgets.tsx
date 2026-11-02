import Link from "next/link";
import { hasAnyRole } from "@/lib/auth/roles";
import type { StaffContext } from "@/lib/auth/session";
import { taskInclude } from "@/lib/crm/tasks";
import type { WidgetKey } from "@/lib/dashboard/widgets";
import { orderRef } from "@/lib/orders/numbers";
import { today } from "@/lib/production/defaults";
import { visitStats } from "@/lib/store/visits";
import { OrderTable, orderTableInclude } from "@/components/admin/order-table";
import { TaskList } from "@/components/admin/tasks";
import { StatusBadge } from "@/components/admin/order-table";
import { CreateQuote } from "./create-quote";

// What each dashboard widget shows. Rendered on the server; the board
// (board.tsx) arranges them. Null: nothing to show right now (hidden
// unless the dashboard is being edited).

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Stat({ label, value, href, warn }: { label: string; value: string | number; href: string; warn?: boolean }) {
  return (
    <Link href={href} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-300">
      <div className={`text-2xl font-bold tracking-tight tabular-nums ${warn ? "text-red-600" : ""}`}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </Link>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-gray-500">{children}</p>;

export async function renderWidget(key: WidgetKey, staff: StaffContext): Promise<React.ReactNode> {
  const { db } = staff;
  const now = today();
  switch (key) {
    case "create-quote":
      return <CreateQuote />;

    case "quick-actions": {
      const actions = [
        { href: "/admin/customers", label: "New quote or order", roles: ["SALES"] },
        { href: "/admin/customers#new-customer", label: "Add a customer", roles: ["SALES"] },
        { href: "/admin/leads#new-lead", label: "Add a lead", roles: ["SALES"] },
        { href: "/admin/price-check", label: "Price check", roles: ["SALES"] },
        { href: "/admin/production", label: "Production board", roles: ["PRODUCTION"] },
        { href: "/admin/purchasing", label: "Purchasing", roles: ["PURCHASING"] },
        { href: "/admin/shipping", label: "Ready to ship", roles: ["SHIPPING"] },
        { href: "/admin/stores", label: "Webstores", roles: ["STORE_MANAGER"] },
      ] as const;
      return (
        <div className="flex flex-wrap gap-2">
          {actions.filter((a) => hasAnyRole(staff.roles, [...a.roles])).map((a) => (
            <Link key={a.href} href={a.href} className="btn-secondary">{a.label}</Link>
          ))}
        </div>
      );
    }

    case "my-tasks": {
      const tasks = await db.task.findMany({
        where: { assigneeId: staff.id, doneAt: null, dueDate: { lte: now } },
        include: taskInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        take: 10,
      });
      return tasks.length ? <TaskList tasks={tasks} showAssignee={false} /> : <Empty>Nothing due. <Link href="/admin/tasks" className="text-brand-700 hover:underline">All tasks →</Link></Empty>;
    }

    case "assigned-to-me": {
      const mine = await db.order.findMany({
        where: { assignedToId: staff.id, status: { isClosed: false } },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 20,
        include: orderTableInclude,
      });
      return <OrderTable orders={mine} empty="Nothing open is assigned to you." />;
    }

    case "floor-stats": {
      const [jobsToday, jobsLate, openPos, readyToShip, stocked] = await Promise.all([
        db.productionJob.count({ where: { scheduledFor: now, status: { not: "DONE" } } }),
        db.productionJob.count({ where: { status: { not: "DONE" }, order: { dueDate: { lt: now }, status: { isClosed: false } } } }),
        db.purchaseOrder.count({ where: { status: { in: ["SENT", "PARTIAL"] } } }),
        db.order.count({ where: { type: "ORDER", status: { role: "ORDER_READY" } } }),
        db.productVariant.findMany({ where: { reorderPoint: { not: null }, stockOnHand: { not: null } }, select: { stockOnHand: true, reorderPoint: true } }),
      ]);
      const lowStock = stocked.filter((v) => v.stockOnHand! <= v.reorderPoint!).length;
      const can = (r: Parameters<typeof hasAnyRole>[1]) => hasAnyRole(staff.roles, r);
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="floor-stats">
          {can(["PRODUCTION"]) && <Stat label="Jobs on today's schedule" value={jobsToday} href="/admin/production/calendar" />}
          {can(["PRODUCTION"]) && <Stat label="Jobs past the due date" value={jobsLate} href="/admin/production" warn={jobsLate > 0} />}
          {can(["PURCHASING"]) && <Stat label="Purchase orders on the way" value={openPos} href="/admin/purchasing" />}
          {can(["PURCHASING"]) && <Stat label="Low-stock items" value={lowStock} href="/admin/inventory?low=1" warn={lowStock > 0} />}
          {can(["SHIPPING"]) && <Stat label="Ready to go out" value={readyToShip} href="/admin/shipping" />}
        </div>
      );
    }

    case "sales-snapshot": {
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const notCancelled = { NOT: { status: { isClosed: true, OR: [{ role: null }, { role: { notIn: ["ORDER_FULFILLED" as const] } }] } } };
      const [booked, openQuotes, open] = await Promise.all([
        db.order.findMany({ where: { type: "ORDER", source: { not: "STORE_BATCH" }, createdAt: { gte: monthStart }, ...notCancelled }, select: { total: true } }),
        db.order.findMany({ where: { type: "QUOTE", status: { isClosed: false } }, select: { total: true } }),
        db.order.findMany({ where: { type: "ORDER", source: { not: "STORE_BATCH" }, status: { isClosed: false } }, select: { total: true, paidTotal: true } }),
      ]);
      const sum = (rows: { total: { toNumber(): number } }[]) => rows.reduce((n, r) => n + r.total.toNumber(), 0);
      const owed = open.reduce((n, o) => n + Math.max(0, o.total.toNumber() - o.paidTotal.toNumber()), 0);
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={`Booked this month (${booked.length} orders)`} value={money(sum(booked))} href="/admin/reports?days=30" />
          <Stat label={`Open quotes (${openQuotes.length})`} value={money(sum(openQuotes))} href="/admin/orders?type=QUOTE" />
          <Stat label="Waiting to be paid" value={money(owed)} href="/admin/reports" warn={owed > 0} />
        </div>
      );
    }

    case "recent-quotes": {
      const quotes = await db.order.findMany({ where: { type: "QUOTE" }, orderBy: { createdAt: "desc" }, take: 8, include: { status: true, customer: { select: { firstName: true, lastName: true } } } });
      return quotes.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {quotes.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/orders/${q.id}`} className="min-w-0 truncate">
                <span className="font-medium text-brand-700">{orderRef(q)}</span> {q.title ?? `${q.customer.firstName} ${q.customer.lastName}`}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                <StatusBadge status={q.status} />
                <span className="tabular-nums">${q.total.toFixed(2)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No quotes yet.</Empty>
      );
    }

    case "due-soon": {
      const week = new Date(now.getTime() + 7 * 86_400_000);
      const orders = await db.order.findMany({ where: { type: "ORDER", status: { isClosed: false }, dueDate: { gte: now, lte: week } }, orderBy: { dueDate: "asc" }, take: 10, include: { status: true, customer: { select: { firstName: true, lastName: true } } } });
      return orders.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/orders/${o.id}`} className="min-w-0 truncate">
                <span className="font-medium text-brand-700">{orderRef(o)}</span> {o.title ?? `${o.customer.firstName} ${o.customer.lastName}`}
              </Link>
              <span className="shrink-0 text-gray-600">{o.dueDate!.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing due in the next 7 days.</Empty>
      );
    }

    case "store-requests": {
      const requests = await db.storeRequest.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 8, include: { store: { select: { id: true, name: true } } } });
      return requests.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {requests.map((r) => (
            <li key={r.id} className="py-2">
              <Link href={`/admin/stores/${r.store.id}/requests`} className="font-medium text-brand-700 hover:underline">{r.subject}</Link>
              <span className="text-gray-500"> · {r.store.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No new requests.</Empty>
      );
    }

    case "setup-check": {
      const placeholder = await db.decorationPriceTable.count({ where: { isPlaceholder: true } });
      return placeholder > 0 ? (
        <div className="rounded-md border border-warn-300 bg-warn-50 px-3 py-2 text-sm text-warn-900">
          {placeholder} decoration price table{placeholder === 1 ? " still has" : "s still have"} placeholder prices.{" "}
          <Link href="/admin/methods" className="font-medium underline">Enter real prices</Link> before taking orders.
        </div>
      ) : null;
    }

    // ─── Production ───────────────────────────────────────────────────

    case "production-actions": {
      const actions = [
        { href: "/admin/production", label: "Production board", roles: ["PRODUCTION"] },
        { href: "/admin/production/calendar", label: "Calendar", roles: ["PRODUCTION"] },
        { href: "/admin/purchasing", label: "Purchasing", roles: ["PURCHASING"] },
        { href: "/admin/inventory?low=1", label: "Low stock", roles: ["PURCHASING"] },
        { href: "/admin/shipping", label: "Shipping", roles: ["SHIPPING"] },
        { href: "/admin/orders?type=ORDER", label: "Orders", roles: [] },
      ] as const;
      return (
        <div className="flex flex-wrap gap-2">
          {actions.filter((a) => hasAnyRole(staff.roles, [...a.roles])).map((a) => (
            <Link key={a.href} href={a.href} className="btn-secondary">{a.label}</Link>
          ))}
        </div>
      );
    }

    case "jobs-today":
    case "late-jobs":
    case "in-progress": {
      const where =
        key === "jobs-today"
          ? { scheduledFor: now, status: { not: "DONE" as const } }
          : key === "late-jobs"
            ? { status: { not: "DONE" as const }, order: { dueDate: { lt: now }, status: { isClosed: false } } }
            : { status: "IN_PROGRESS" as const };
      const jobs = await db.productionJob.findMany({
        where,
        orderBy: [{ order: { dueDate: { sort: "asc", nulls: "last" } } }],
        take: 10,
        include: { method: { select: { shortName: true } }, order: { select: { id: true, type: true, number: true, title: true, dueDate: true, customer: { select: { firstName: true, lastName: true } } } }, steps: { where: { doneAt: null }, orderBy: { sortOrder: "asc" }, take: 1, select: { name: true } } },
      });
      if (jobs.length === 0) return <Empty>{key === "jobs-today" ? "Nothing scheduled for today." : key === "late-jobs" ? "No late jobs." : "Nothing in progress."}</Empty>;
      return (
        <ul className="divide-y divide-gray-100 text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/orders/${j.order.id}`} className="min-w-0 truncate">
                <span className="font-medium text-brand-700">{orderRef(j.order)}</span> {j.method.shortName} · {j.order.title ?? `${j.order.customer.firstName} ${j.order.customer.lastName}`}
              </Link>
              <span className="shrink-0 text-xs text-gray-600">
                {j.steps[0] ? `Next: ${j.steps[0].name}` : "All steps done"}
                {j.order.dueDate && <span className={j.order.dueDate < now ? " text-red-700" : ""}> · due {j.order.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    case "ready-to-ship": {
      const orders = await db.order.findMany({ where: { type: "ORDER", status: { role: "ORDER_READY" } }, orderBy: { updatedAt: "asc" }, take: 10, include: { deliveryMethod: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } } } });
      return orders.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/orders/${o.id}`} className="min-w-0 truncate">
                <span className="font-medium text-brand-700">{orderRef(o)}</span> {o.title ?? `${o.customer.firstName} ${o.customer.lastName}`}
              </Link>
              <span className="shrink-0 text-xs text-gray-600">{o.deliveryMethod?.name ?? "No delivery method"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing waiting to go out.</Empty>
      );
    }

    case "low-stock": {
      const stocked = await db.productVariant.findMany({
        where: { reorderPoint: { not: null }, stockOnHand: { not: null } },
        select: { id: true, stockOnHand: true, reorderPoint: true, product: { select: { name: true, styleCode: true } }, color: { select: { name: true } }, size: { select: { code: true } } },
      });
      const low = stocked.filter((v) => v.stockOnHand! <= v.reorderPoint!).slice(0, 10);
      return low.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {low.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate"><span className="font-mono text-xs text-gray-500">{v.product.styleCode}</span> {v.color.name} {v.size.code}</span>
              <span className="shrink-0 text-xs"><span className="font-semibold text-red-700">{v.stockOnHand}</span> <span className="text-gray-500">/ reorder at {v.reorderPoint}</span></span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing low. <Link href="/admin/inventory" className="text-brand-700 hover:underline">Inventory →</Link></Empty>
      );
    }

    // ─── Web ──────────────────────────────────────────────────────────

    case "web-actions": {
      const actions = [
        { href: "/admin/stores#new-store", label: "New store" },
        { href: "/admin/stores", label: "All stores" },
        { href: "/admin/stores/promo-codes", label: "Promo codes" },
        { href: "/admin/stores/gift-codes", label: "Gift codes" },
        { href: "/admin/stores/main-site", label: "Main site" },
        { href: "/admin/reports/stores", label: "Stores report" },
      ];
      return (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => <Link key={a.href} href={a.href} className="btn-secondary">{a.label}</Link>)}
        </div>
      );
    }

    case "web-snapshot": {
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const days = Math.max(1, Math.ceil((Date.now() - monthStart.getTime()) / 86_400_000));
      const [orders, stores, earning, payouts] = await Promise.all([
        db.order.findMany({ where: { type: "ORDER", source: "STOREFRONT", placedAt: { gte: monthStart }, NOT: { status: { isClosed: true, OR: [{ role: null }, { role: { not: "ORDER_FULFILLED" } }] } } }, select: { total: true } }),
        db.store.findMany({ where: { kind: "AFFILIATE" }, select: { id: true } }),
        db.order.findMany({ where: { type: "ORDER", source: "STOREFRONT", commission: { gt: 0 } }, select: { total: true, paidTotal: true, commission: true } }),
        db.commissionPayout.findMany({ select: { amount: true } }),
      ]);
      const visits = [...(await visitStats(db, stores.map((s) => s.id), days)).values()].reduce((n, v) => n + v.visits, 0);
      const earned = earning.filter((o) => o.paidTotal.gte(o.total)).reduce((n, o) => n + o.commission.toNumber(), 0);
      const owed = Math.max(0, earned - payouts.reduce((n, p) => n + p.amount.toNumber(), 0));
      return (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Online sales" value={money(orders.reduce((n, o) => n + o.total.toNumber(), 0))} href="/admin/reports/stores?days=30" />
          <Stat label="Online orders" value={orders.length} href="/admin/orders?type=ORDER" />
          <Stat label="Store visits" value={visits.toLocaleString("en-US")} href="/admin/reports/stores?days=30" />
          <Stat label="Commission owed" value={money(owed)} href="/admin/reports/stores" warn={owed > 0} />
        </div>
      );
    }

    case "closing-soon": {
      const soon = new Date(Date.now() + 14 * 86_400_000);
      const stores = await db.store.findMany({ where: { kind: "AFFILIATE", active: true, closesAt: { gte: new Date(), lte: soon } }, orderBy: { closesAt: "asc" }, take: 10, select: { id: true, name: true, closesAt: true, _count: { select: { orders: true } } } });
      return stores.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {stores.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/stores/${s.id}`} className="truncate font-medium text-brand-700 hover:underline">{s.name}</Link>
              <span className="shrink-0 text-xs text-gray-600">closes {s.closesAt!.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {s._count.orders} order{s._count.orders === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No stores close in the next 14 days.</Empty>
      );
    }

    case "online-orders": {
      const orders = await db.order.findMany({ where: { type: "ORDER", source: "STOREFRONT" }, orderBy: { placedAt: "desc" }, take: 10, include: { store: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } } } });
      return orders.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/orders/${o.id}`} className="min-w-0 truncate">
                <span className="font-medium text-brand-700">{orderRef(o)}</span> {`${o.customer.firstName} ${o.customer.lastName}`.trim()} <span className="text-gray-500">· {o.store?.name ?? "Main site"}</span>
              </Link>
              <span className="shrink-0 tabular-nums">${o.total.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No online orders yet.</Empty>
      );
    }

    case "batches-waiting": {
      const stores = await db.store.findMany({
        where: { batchOrders: true, closesAt: { lt: new Date() }, orders: { some: { heldForBatch: true } } },
        select: { id: true, name: true, closesAt: true, _count: { select: { orders: { where: { heldForBatch: true } } } } },
        take: 10,
      });
      return stores.length ? (
        <ul className="divide-y divide-gray-100 text-sm">
          {stores.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/stores/${s.id}`} className="truncate font-medium text-brand-700 hover:underline">{s.name}</Link>
              <span className="shrink-0 text-xs text-gray-600">{s._count.orders} order{s._count.orders === 1 ? "" : "s"} held · closed {s.closesAt!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No closed stores waiting to batch.</Empty>
      );
    }
  }
}
