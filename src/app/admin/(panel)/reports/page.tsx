import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { periodFrom, rangeOf, salesReport } from "@/lib/reports/reports";
import { Columns, Kpi, money, pct, ReportHeader, Share } from "@/components/admin/report-parts";

export const metadata = { title: "Sales report" };

const SOURCES: Record<string, string> = { STAFF: "Back office", STOREFRONT: "Online stores", QUOTE_REQUEST: "Quote requests" };

export default async function SalesReport({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { db } = await requireStaff(["ADMIN"]);
  const period = periodFrom((await searchParams).days);
  const r = await salesReport(db, rangeOf(period));
  const topMax = r.topCustomers[0]?.total ?? 0;
  return (
    <div className="space-y-6" data-testid="sales-report">
      <ReportHeader title="Sales" intro="Orders booked, money in, and how quotes are converting. Cancelled orders aren't counted." period={period} path="/admin/reports" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Booked" value={money(r.booked)} change={r.bookedChange} highlight />
        <Kpi label="Orders" value={String(r.orders)} change={r.ordersChange} note={r.orders ? `${money(r.average)} on average` : undefined} />
        <Kpi label="Payments received" value={money(r.received)} change={r.receivedChange} />
        <Kpi label="Quote win rate" value={pct(r.winRate)} note={`${r.quotesWon} of ${r.quotes} quotes became orders`} />
      </div>
      <Columns label="Booked by month" data={r.months.map((m) => ({ label: m.label, value: m.total }))} format={money} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card overflow-x-auto p-0">
          <h2 className="px-5 pt-5 pb-3 text-sm font-semibold">Top customers</h2>
          {r.topCustomers.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-500">No orders in this period.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-right">Orders</th>
                  <th className="w-1/3" />
                  <th className="text-right">Booked</th>
                </tr>
              </thead>
              <tbody>
                {r.topCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                      {c.company && <div className="text-xs text-gray-500">{c.company}</div>}
                    </td>
                    <td className="text-right tabular-nums">{c.orders}</td>
                    <td><Share value={c.total} max={topMax} /></td>
                    <td className="text-right font-medium tabular-nums">{money(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">Where orders came from</h2>
            {r.sources.length === 0 ? (
              <p className="text-sm text-gray-500">No orders in this period.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {r.sources.map((s) => (
                  <li key={s.source}>
                    <div className="flex justify-between gap-2">
                      <span>{SOURCES[s.source] ?? s.source} <span className="text-gray-500">· {s.orders}</span></span>
                      <span className="font-medium tabular-nums">{money(s.total)}</span>
                    </div>
                    <div className="mt-1"><Share value={s.total} max={r.booked} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold">Waiting to be paid</h2>
            <div className="mt-1.5 text-2xl font-bold tabular-nums">{money(r.outstanding)}</div>
            <p className="text-xs text-gray-500">On {r.outstandingOrders} open order{r.outstandingOrders === 1 ? "" : "s"}, all time.</p>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold">Quoted</h2>
            <div className="mt-1.5 text-2xl font-bold tabular-nums">{money(r.quotedValue)}</div>
            <p className="text-xs text-gray-500">Across {r.quotes} quote{r.quotes === 1 ? "" : "s"} made in this period.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
