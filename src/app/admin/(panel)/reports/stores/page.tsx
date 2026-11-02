import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { periodFrom, rangeOf, storesReport } from "@/lib/reports/reports";
import { Kpi, money, ReportHeader, Share } from "@/components/admin/report-parts";

export const metadata = { title: "Stores report" };

export default async function StoresReport({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  const period = periodFrom((await searchParams).days);
  const r = await storesReport(db, rangeOf(period));
  const top = r.stores[0]?.sales ?? 0;
  return (
    <div className="space-y-6" data-testid="stores-report">
      <ReportHeader title="Stores" intro="What shoppers bought online, store by store, and the commission store owners have earned." period={period} path="/admin/reports/stores" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Online sales" value={money(r.sales)} change={r.salesChange} note={`${r.orders} orders · ${money(r.mainSiteSales)} on the main site`} highlight />
        <Kpi label="Stores selling" value={String(r.activeStores)} note="Affiliate stores with orders in this period" />
        <Kpi label="Visits" value={r.visits.toLocaleString("en-US")} note="To affiliate stores" />
        <Kpi label="Commission owed" value={money(r.owed)} note={`${money(r.commission)} earned on this period's orders`} />
      </div>
      <div className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-5 pb-3 text-sm font-semibold">Affiliate stores</h2>
        {r.stores.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-gray-500">No store activity in this period.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Store</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Visits</th>
                <th className="text-right">Conversion</th>
                <th className="w-1/5" />
                <th className="text-right">Sales</th>
                <th className="text-right">Commission owed</th>
              </tr>
            </thead>
            <tbody>
              {r.stores.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/stores/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.name}</Link>
                  </td>
                  <td className="text-right tabular-nums">{s.orders}</td>
                  <td className="text-right tabular-nums">{s.visits}</td>
                  <td className="text-right tabular-nums">{s.conversion === null ? "—" : `${(s.conversion * 100).toFixed(1)}%`}</td>
                  <td><Share value={s.sales} max={top} /></td>
                  <td className="text-right font-medium tabular-nums">{money(s.sales)}</td>
                  <td className="text-right tabular-nums">{s.owed ? money(s.owed) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-500">Visits are counted for up to the last 12 months. Commission is earned once an order is paid in full; what&apos;s owed is earned minus paid out, all time.</p>
    </div>
  );
}
