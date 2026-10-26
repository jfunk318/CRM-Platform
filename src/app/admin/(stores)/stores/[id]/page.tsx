import Link from "next/link";
import { loadAdminStore } from "@/lib/store/admin";
import { OrderTable, orderTableInclude } from "@/components/admin/order-table";
import { ActionForm } from "@/components/admin/action-form";
import { orderRef } from "@/lib/orders/numbers";
import { heldOrdersWhere } from "@/lib/store/batches";
import { conversion, visitStats } from "@/lib/store/visits";
import { VisitBars } from "@/components/admin/visit-bars";
import { batchNowAction } from "../actions";

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** One store at a glance: sales, setup and its latest orders. */
export default async function StoreOverview({ params }: { params: Promise<{ id: string }> }) {
  const { db, store, url } = await loadAdminStore((await params).id);
  const [held, batches] = await Promise.all([
    db.order.findMany({ where: heldOrdersWhere(store.id), select: { id: true, lines: { select: { sizes: { select: { qty: true } } } } } }),
    db.storeBatch.findMany({ where: { storeId: store.id }, orderBy: { number: "desc" }, include: { order: { include: { status: true } }, _count: { select: { orders: true } } } }),
  ]);
  const heldPieces = held.reduce((n, o) => n + o.lines.reduce((m, l) => m + l.sizes.reduce((a, s) => a + s.qty, 0), 0), 0);
  const visits = (await visitStats(db, [store.id])).get(store.id)!;
  // Orders since visits were first counted in the period, so the two compare.
  const recentOrders = visits.since ? await db.order.count({ where: { storeId: store.id, type: "ORDER", source: "STOREFRONT", placedAt: { gte: visits.since } } }) : 0;
  const [sales, items, published, pages, orders] = await Promise.all([
    db.order.aggregate({ where: { storeId: store.id, type: "ORDER", source: { not: "STORE_BATCH" } }, _sum: { total: true }, _count: true, _max: { placedAt: true } }),
    db.storeItem.count({ where: { storeId: store.id } }),
    db.storeItem.count({ where: { storeId: store.id, published: true } }),
    db.storePage.count({ where: { storeId: store.id } }),
    db.order.findMany({ where: { storeId: store.id }, include: orderTableInclude, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4" data-testid="store-stats">
        <Stat label="Orders" value={String(sales._count)} />
        <Stat label="Sales" value={money(sales._sum.total ?? 0)} />
        <Stat label="Items on sale" value={`${published} of ${items}`} href={`/admin/stores/${store.id}/items`} />
        <Stat label="Last order" value={sales._max.placedAt ? day(sales._max.placedAt) : "—"} />
      </div>
      <section className="card flex flex-wrap items-end gap-6" data-testid="store-visits">
        <div>
          <div className="text-2xl font-semibold">{visits.visits}</div>
          <div className="text-sm text-gray-500">Visits, last 30 days ({visits.views} pages viewed)</div>
        </div>
        <div>
          <div className="text-2xl font-semibold">{conversion(recentOrders, visits.visits)}</div>
          <div className="text-sm text-gray-500">Visits that ordered ({recentOrders} order{recentOrders === 1 ? "" : "s"})</div>
        </div>
        <VisitBars daily={visits.daily} className="min-w-48 flex-1" />
      </section>
      <section className="card grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <div className="label">Address</div>
          <a href={url} target="_blank" className="font-mono text-amber-700 hover:underline">{url.replace(/^https?:\/\//, "")}</a>
        </div>
        <div>
          <div className="label">{store.kind === "ROOT" ? "Site" : "Store for"}</div>
          {store.customer ? (
            <Link href={`/admin/customers/${store.customer.id}`} className="text-amber-700 hover:underline">{store.customer.firstName} {store.customer.lastName}</Link>
          ) : (
            <span className="text-gray-500">{store.kind === "ROOT" ? "Your own main site" : "No customer set"}</span>
          )}
        </div>
        <div>
          <div className="label">Manager</div>
          {store.manager?.name ?? <span className="text-gray-500">Nobody</span>}
        </div>
        <div>
          <div className="label">Dates</div>
          {store.opensAt || store.closesAt ? (
            <>{store.opensAt ? `Opens ${day(store.opensAt)}` : "Open"}{store.closesAt ? ` · closes ${day(store.closesAt)}` : ""}</>
          ) : (
            <span className="text-gray-500">Always open</span>
          )}
        </div>
        <div>
          <div className="label">Pages</div>
          <Link href={`/admin/stores/${store.id}/pages`} className="text-amber-700 hover:underline">{pages} page{pages === 1 ? "" : "s"}</Link>
        </div>
        <div>
          <div className="label">Showcase</div>
          {store.kind === "ROOT" ? "Shows the other stores" : store.showcase ? "Included" : <span className="text-gray-500">Left out</span>}
        </div>
      </section>
      {(store.batchOrders || held.length > 0 || batches.length > 0) && (
        <section className="card space-y-3" data-testid="store-batches">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Batches</h2>
              <p className="text-sm text-gray-600">
                {held.length > 0
                  ? `${held.length} order${held.length === 1 ? "" : "s"} (${heldPieces} pieces) waiting for the batch${store.closesAt && store.batchOrders ? `; it's made when the store closes on ${day(store.closesAt)}` : ""}.`
                  : "No orders waiting."}
              </p>
            </div>
            {held.length > 0 && (
              <ActionForm action={batchNowAction} submitLabel="Batch now" confirm={`Combine ${held.length} order${held.length === 1 ? "" : "s"} into one production order now?`} className="flex">
                <input type="hidden" name="storeId" value={store.id} />
              </ActionForm>
            )}
          </div>
          {batches.length > 0 && (
            <ul className="divide-y divide-gray-100 text-sm">
              {batches.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>
                    Batch {b.number} · {day(b.createdAt)} · {b._count.orders} order{b._count.orders === 1 ? "" : "s"}
                  </span>
                  <Link href={`/admin/orders/${b.orderId}`} className="text-amber-700 hover:underline">
                    Order {orderRef(b.order)} · {b.order.status.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="font-semibold">Latest orders</h2>
        <OrderTable orders={orders} empty="No orders from this store yet." />
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </>
  );
  return href ? <Link href={href} className="card block hover:border-amber-300">{body}</Link> : <div className="card">{body}</div>;
}
