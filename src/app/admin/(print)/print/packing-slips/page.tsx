import { requireStaff } from "@/lib/auth/session";
import { orderRef } from "@/lib/orders/numbers";
import { shipmentProgress, shippingOrderInclude } from "@/lib/shipping/service";

export const metadata = { title: "Packing slips" };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** One packing slip per order (?id=…&id=… or ?ids=a,b), each on its own page. */
export default async function PackingSlips({ searchParams }: { searchParams: Promise<{ id?: string | string[]; ids?: string }> }) {
  const { db, business } = await requireStaff();
  const sp = await searchParams;
  const ids = [...[sp.id ?? []].flat(), ...(sp.ids?.split(",") ?? [])].filter(Boolean).slice(0, 100);
  const orders = ids.length
    ? await db.order.findMany({ where: { id: { in: ids }, type: "ORDER" }, include: { ...shippingOrderInclude, company: true }, orderBy: { number: "asc" } })
    : [];
  if (orders.length === 0) return <p>Choose orders on the Shipping page first.</p>;
  const from = [business.name, business.addressLine1, [business.city, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "), business.phone].filter(Boolean);
  return (
    <div>
      {orders.map((o) => {
        const progress = shipmentProgress(o);
        const shipTo = [o.shipName ?? `${o.customer.firstName} ${o.customer.lastName}`, o.company?.name, o.shipLine1, o.shipLine2, [o.shipCity, [o.shipRegion, o.shipPostalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean);
        return (
          <article key={o.id} className="space-y-4 text-sm [page-break-after:always] last:[page-break-after:auto]" data-testid="slip">
            <header className="flex items-start justify-between border-b-2 border-black pb-2">
              <div>{from.map((l, i) => <div key={i} className={i === 0 ? "text-lg font-bold" : ""}>{l}</div>)}</div>
              <div className="text-right">
                <h1 className="text-2xl font-bold">Packing slip</h1>
                <div className="text-lg">Order {orderRef(o)}</div>
                <div>{day(new Date())}</div>
              </div>
            </header>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs uppercase text-gray-600">{o.deliveryMethod?.kind === "PICKUP" ? "Customer" : "Ship to"}</div>
                {shipTo.map((l, i) => <div key={i}>{l}</div>)}
              </div>
              <div>
                <div className="text-xs uppercase text-gray-600">Delivery</div>
                <div>{o.deliveryMethod?.name ?? "—"}</div>
                {o.title && <div className="mt-1">Job: {o.title}</div>}
              </div>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-1">Item</th>
                  <th className="text-right">Ordered</th>
                  <th className="text-right">Sent before</th>
                  <th className="text-right">In this box</th>
                </tr>
              </thead>
              <tbody>
                {progress.rows.map((r) => (
                  <tr key={`${r.lineId}:${r.sizeId}`} className="border-b border-gray-300">
                    <td className="py-1">{r.description}</td>
                    <td className="text-right">{r.ordered}</td>
                    <td className="text-right">{r.shipped || ""}</td>
                    <td className="text-right"><span className="inline-block h-5 w-12 border border-gray-500 align-middle" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pt-4 text-center text-gray-600">Thank you for your order! Questions? {business.email ?? business.phone ?? ""}</p>
          </article>
        );
      })}
    </div>
  );
}
