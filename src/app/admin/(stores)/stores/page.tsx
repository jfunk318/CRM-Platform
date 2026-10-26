import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { storeUrlHere } from "@/lib/business";
import { newRequestCounts } from "@/lib/store/portal";
import { visitStats } from "@/lib/store/visits";
import { storeStatus } from "@/lib/store/settings";
import { ActionForm } from "@/components/admin/action-form";
import { createStoreAction } from "./actions";

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;
const STATE_CLASS = { open: "bg-green-50 text-green-800", scheduled: "bg-blue-50 text-blue-800", closed: "bg-gray-100 text-gray-600" } as const;
const VIEWS = { newest: "Newest", sales: "Highest sales", closing: "Closing soon", name: "Name" } as const;
type View = keyof typeof VIEWS;

type Search = { q?: string; group?: string; status?: string; manager?: string; view?: string };

/** Every affiliate store at a glance, with search, filters and views. */
export default async function StoresDashboard({ searchParams }: { searchParams: Promise<Search> }) {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "newest";
  const q = sp.q?.trim();
  const where: Prisma.StoreWhereInput = {
    kind: "AFFILIATE",
    ...(sp.group ? { groupId: sp.group === "none" ? null : sp.group } : {}),
    ...(sp.manager ? { managerId: sp.manager === "none" ? null : sp.manager } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q.toLowerCase() } },
            { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } },
          ],
        }
      : {}),
  };
  const [all, groups, managers, sales, root, customers] = await Promise.all([
    db.store.findMany({ where, include: { group: true, manager: { select: { name: true } }, customer: true, _count: { select: { items: { where: { published: true } } } } }, orderBy: { createdAt: "desc" } }),
    db.storeGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.order.groupBy({ by: ["storeId"], where: { type: "ORDER", storeId: { not: null }, source: { not: "STORE_BATCH" } }, _sum: { total: true }, _count: true }),
    db.store.findFirst({ where: { kind: "ROOT" } }),
    db.customer.count(),
  ]);
  const requests = await newRequestCounts(db);
  const visits = await visitStats(db, all.map((s) => s.id));
  const salesOf = (id: string) => sales.find((s) => s.storeId === id);
  const now = new Date();
  let stores = all.map((s) => ({ ...s, status: storeStatus(s, now), orders: salesOf(s.id)?._count ?? 0, total: salesOf(s.id)?._sum.total ?? null }));
  if (sp.status) stores = stores.filter((s) => s.status.state === sp.status);
  if (view === "sales") stores.sort((a, b) => (b.total?.toNumber() ?? 0) - (a.total?.toNumber() ?? 0));
  if (view === "closing") stores = stores.filter((s) => s.closesAt && s.status.state !== "closed").sort((a, b) => a.closesAt!.getTime() - b.closesAt!.getTime());
  if (view === "name") stores.sort((a, b) => a.name.localeCompare(b.name));
  const urls = new Map(await Promise.all(stores.map(async (s) => [s.id, await storeUrlHere(s.slug)] as const)));
  const href = (p: Partial<Search>) => {
    const qs = new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/admin/stores${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Affiliate stores</h1>
          <p className="text-sm text-gray-500">Stores you run for your customers at their own addresses. Their orders land in the business admin like any other.</p>
        </div>
        {root && (
          <Link href={`/admin/stores/${root.id}`} className="btn-secondary">Main site: {root.name}</Link>
        )}
      </div>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Views">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={href({ view: v === "newest" ? undefined : v })} className={`rounded-full border px-3 py-1 ${view === v ? "border-amber-500 bg-amber-50" : "border-gray-200 bg-white"}`}>{VIEWS[v]}</Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-2" action="/admin/stores">
        {sp.view && <input type="hidden" name="view" value={sp.view} />}
        <input className="input w-60" name="q" defaultValue={q ?? ""} placeholder="Store, owner, email or phone" aria-label="Search stores" />
        <select className="input w-40" name="group" defaultValue={sp.group ?? ""} aria-label="Group">
          <option value="">All groups</option>
          <option value="none">No group</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input w-36" name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="scheduled">Not open yet</option>
          <option value="closed">Closed</option>
        </select>
        <select className="input w-40" name="manager" defaultValue={sp.manager ?? ""} aria-label="Manager">
          <option value="">Any manager</option>
          <option value="none">No manager</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table" data-testid="stores-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Status</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Sales</th>
              <th className="text-right" title="Visits in the last 30 days">Visits (30d)</th>
              <th>Manager</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stores.length === 0 && (
              <tr>
                <td colSpan={7} className="text-gray-500">{all.length === 0 && !q ? "No affiliate stores yet. Create the first one below." : "No stores match."}</td>
              </tr>
            )}
            {stores.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/admin/stores/${s.id}`} className="font-medium text-amber-700 hover:underline">{s.name}</Link>
                  {requests.get(s.id) && (
                    <Link href={`/admin/stores/${s.id}/requests`} className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white" data-testid="store-request-flag">
                      {requests.get(s.id)} new request{requests.get(s.id) === 1 ? "" : "s"}
                    </Link>
                  )}
                  {s.group && <span className="ml-1.5 rounded-full border border-gray-200 px-1.5 text-[11px] text-gray-600">{s.group.name}</span>}
                  <div className="text-xs text-gray-500">
                    <a href={urls.get(s.id)} target="_blank" className="font-mono hover:underline">{urls.get(s.id)!.replace(/^https?:\/\//, "")}</a>
                    {s.customer && <> · {s.customer.firstName} {s.customer.lastName}</>} · {s._count.items} item{s._count.items === 1 ? "" : "s"}
                  </div>
                </td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATE_CLASS[s.status.state]}`}>{s.status.label}</span></td>
                <td className="text-right">{s.orders}</td>
                <td className="text-right">{s.total ? money(s.total) : "—"}</td>
                <td className="text-right">{visits.get(s.id)?.visits ?? 0}</td>
                <td>{s.manager?.name ?? <span className="text-gray-400">—</span>}</td>
                <td><Link href={`/admin/stores/${s.id}`} className="btn-secondary px-2 py-1 text-xs">Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="card" open={all.length === 0 && !q}>
        <summary className="cursor-pointer font-medium text-amber-700">+ New affiliate store</summary>
        <ActionForm action={createStoreAction} submitLabel="Create store" className="mt-4 grid gap-3 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="label" htmlFor="new-name">Store name</label>
            <input className="input" id="new-name" name="name" required placeholder="Lincoln Hockey" />
          </div>
          <div>
            <label className="label" htmlFor="new-slug">Address (subdomain)</label>
            <input className="input font-mono" id="new-slug" name="slug" placeholder="from the name" />
          </div>
          <div>
            <label className="label" htmlFor="new-group">Group</label>
            <select className="input" id="new-group" name="groupId">
              <option value="">No group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-manager">Manager</label>
            <select className="input" id="new-manager" name="managerId">
              <option value="">Nobody</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500 sm:col-span-4">
            You can link the store to one of your {customers} customers, set dates and branding, and add items once it&apos;s created.
          </p>
        </ActionForm>
      </details>
    </div>
  );
}
