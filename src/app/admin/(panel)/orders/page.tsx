import Link from "next/link";
import type { OrderType, Prisma } from "@prisma/client";
import { NavHint } from "@/components/admin/side-nav";
import { requireStaff } from "@/lib/auth/session";
import { OrderTable, orderTableInclude } from "@/components/admin/order-table";

const PAGE_SIZE = 50;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; who?: string; q?: string; show?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const { db } = staff;
  const sp = await searchParams;
  const type: OrderType = sp.type === "QUOTE" ? "QUOTE" : "ORDER";
  const who = sp.who ?? "";
  const show = sp.show === "closed" || sp.show === "all" ? sp.show : "open";
  const q = (sp.q ?? "").trim();
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const num = Number(q.replace(/^(Q-|#)/i, ""));

  const where: Prisma.OrderWhereInput = {
    type,
    ...(sp.status && { statusId: sp.status }),
    ...(show !== "all" && { status: { isClosed: show === "closed" } }),
    ...(who === "me" && { assignedToId: staff.id }),
    ...(who === "none" && { assignedToId: null }),
    ...(who && who !== "me" && who !== "none" && { assignedToId: who }),
    ...(q && {
      OR: [
        ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
        { title: { contains: q, mode: "insensitive" } },
        { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const [orders, total, statuses, staffList] = await Promise.all([
    db.order.findMany({
      where,
      // Soonest due first; undated after, newest first.
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: orderTableInclude,
    }),
    db.order.count({ where }),
    db.orderStatus.findMany({ where: { type }, orderBy: { sortOrder: "asc" } }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (patch: Record<string, string>) =>
    `?${new URLSearchParams({ type, status: sp.status ?? "", who, q, show, ...patch }).toString()}`;

  return (
    <div className="space-y-6">
      <NavHint href={`/admin/orders?type=${type}`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-200/70 p-1">
          {(["QUOTE", "ORDER"] as const).map((t) => (
            <Link
              key={t}
              href={`?type=${t}`}
              className={`rounded-md px-3 py-1 text-sm ${type === t ? "bg-white font-medium shadow-sm" : "text-gray-600"}`}
            >
              {t === "QUOTE" ? "Quotes" : "Orders"}
            </Link>
          ))}
        </div>
        <Link href="/admin/customers" className="btn">New {type === "QUOTE" ? "quote" : "order"} (pick a customer)</Link>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value={type} />
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input className="input" id="q" name="q" defaultValue={q} placeholder="Number, customer, company or title" />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={sp.status ?? ""}>
            <option value="">Any</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="who">Assigned to</label>
          <select className="input" id="who" name="who" defaultValue={who}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="none">Unassigned</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="show">Show</label>
          <select className="input" id="show" name="show" defaultValue={show}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
      </form>

      <OrderTable orders={orders} empty={total === 0 && !q ? `No ${show === "open" ? "open " : ""}${type === "QUOTE" ? "quotes" : "orders"}.` : "No matches."} />
      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {pageNum > 1 && <Link className="btn-secondary" href={link({ page: String(pageNum - 1) })}>← Previous</Link>}
          <span>Page {pageNum} of {pages} ({total})</span>
          {pageNum < pages && <Link className="btn-secondary" href={link({ page: String(pageNum + 1) })}>Next →</Link>}
        </div>
      )}
    </div>
  );
}
