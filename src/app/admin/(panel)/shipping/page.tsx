import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { orderRef } from "@/lib/orders/numbers";
import { carrierName, DELIVERY_KIND_LABELS, shipmentProgress, shippingOrderInclude, trackingUrl } from "@/lib/shipping/service";

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const when = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { db } = await requireStaff(["SHIPPING"]);
  const { all } = await searchParams;
  const [orders, recent] = await Promise.all([
    db.order.findMany({
      where: { type: "ORDER", status: { isClosed: false }, lines: { some: {} } },
      include: { ...shippingOrderInclude, status: true, productionJobs: { select: { status: true } } },
      orderBy: [{ rush: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { number: "asc" }],
    }),
    db.shipment.findMany({ take: 15, orderBy: { shippedAt: "desc" }, include: { order: true, items: true } }),
  ]);
  const rows = orders
    .map((o) => {
      const progress = shipmentProgress(o);
      const jobsDone = o.productionJobs.filter((j) => j.status === "DONE").length;
      const ready = o.status.role === "ORDER_READY" || (o.productionJobs.length > 0 && jobsDone === o.productionJobs.length);
      return { o, progress, jobsDone, ready };
    })
    .filter((r) => !r.progress.complete && (all || r.ready));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Shipping</h1>
        <p className="text-sm text-gray-500">
          Orders with production finished and something left to send. Record shipments and pickups on each order; tick
          orders to print their packing slips together.
        </p>
      </div>
      <nav className="flex gap-2 text-sm">
        <Link href="/admin/shipping" className={`rounded-full border px-3 py-1 ${!all ? "border-amber-500 bg-amber-50" : "border-gray-200 bg-white"}`}>Ready to go</Link>
        <Link href="/admin/shipping?all=1" className={`rounded-full border px-3 py-1 ${all ? "border-amber-500 bg-amber-50" : "border-gray-200 bg-white"}`}>All open orders</Link>
      </nav>

      <form action="/admin/print/packing-slips" method="get" target="_blank" className="space-y-3">
        <div className="card overflow-x-auto p-0">
          <table className="table" data-testid="ship-list">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Order</th>
                <th>Delivery</th>
                <th>Ship to</th>
                <th className="text-right">Pieces to go</th>
                <th>Production</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-gray-500">{all ? "Nothing left to send." : "Nothing is ready to go out."}</td>
                </tr>
              )}
              {rows.map(({ o, progress, jobsDone, ready }) => (
                <tr key={o.id}>
                  <td>
                    <input type="checkbox" name="id" value={o.id} aria-label={`Packing slip for ${orderRef(o)}`} />
                  </td>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-amber-700 hover:underline">{orderRef(o)}</Link>
                    <div className="text-xs text-gray-500">{o.customer.firstName} {o.customer.lastName}</div>
                  </td>
                  <td>{o.deliveryMethod ? `${o.deliveryMethod.name}` : <span className="text-gray-400">Not set</span>}</td>
                  <td className="text-sm">{o.deliveryMethod?.kind === "PICKUP" ? "—" : [o.shipCity, o.shipRegion].filter(Boolean).join(", ") || <span className="text-amber-700">No address</span>}</td>
                  <td className="text-right">{progress.remaining}{progress.remaining !== progress.total && <span className="text-xs text-gray-500"> of {progress.total}</span>}</td>
                  <td className={ready ? "text-green-700" : "text-gray-600"}>
                    {o.productionJobs.length ? `${jobsDone}/${o.productionJobs.length} jobs done` : o.status.name}
                  </td>
                  <td>
                    {o.dueDate ? day(o.dueDate) : "—"}
                    {o.rush && <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700">Rush</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && <button className="btn-secondary">Print packing slips for ticked orders</button>}
      </form>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Recently sent</h2>
        {recent.length === 0 && <p className="text-gray-500">Nothing yet.</p>}
        <ul className="divide-y divide-gray-100">
          {recent.map((sh) => {
            const url = trackingUrl(sh.carrier, sh.trackingNumber);
            return (
              <li key={sh.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>
                  <Link href={`/admin/orders/${sh.orderId}`} className="text-amber-700 hover:underline">{orderRef(sh.order)}</Link> ·{" "}
                  {sh.kind === "SHIP" ? `Shipped${sh.carrier ? ` ${carrierName(sh.carrier)}` : ""}` : DELIVERY_KIND_LABELS[sh.kind]} · {sh.items.reduce((n, i) => n + i.qty, 0)} pcs
                  {sh.trackingNumber && <> · {url ? <a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs text-amber-700 hover:underline">{sh.trackingNumber}</a> : <span className="font-mono text-xs">{sh.trackingNumber}</span>}</>}
                </span>
                <span className="text-xs text-gray-500">{when(sh.shippedAt)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
