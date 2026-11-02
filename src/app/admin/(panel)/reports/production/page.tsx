import { requireStaff } from "@/lib/auth/session";
import { periodFrom, productionReport, rangeOf } from "@/lib/reports/reports";
import { Columns, Kpi, pct, ReportHeader, Share } from "@/components/admin/report-parts";

export const metadata = { title: "Production report" };

export default async function ProductionReport({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { db } = await requireStaff(["PRODUCTION"]);
  const period = periodFrom((await searchParams).days);
  const r = await productionReport(db, rangeOf(period));
  const top = r.methods[0]?.done ?? 0;
  return (
    <div className="space-y-6" data-testid="production-report">
      <ReportHeader title="Production" intro="Jobs finished, how many made their due date, and what's on the floor now." period={period} path="/admin/reports/production" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Jobs finished" value={String(r.done)} change={r.doneChange} highlight />
        <Kpi label="On time" value={pct(r.onTimeRate)} note="Of finished jobs with a due date" />
        <Kpi label="Average turnaround" value={r.turnaround === null ? "—" : `${r.turnaround.toFixed(1)} days`} note="From job created to done" />
        <Kpi label="On the floor now" value={String(r.queued + r.inProgress)} note={`${r.inProgress} in progress · ${r.queued} queued${r.late ? ` · ${r.late} past due` : ""}`} />
      </div>
      <Columns label="Jobs finished per week" data={r.weekly.map((w) => ({ label: w.label, value: w.count }))} format={(n) => String(n)} />
      <div className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-5 pb-3 text-sm font-semibold">By decoration method</h2>
        {r.methods.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-gray-500">No jobs finished in this period.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th className="w-1/3" />
                <th className="text-right">Jobs finished</th>
                <th className="text-right">On time</th>
              </tr>
            </thead>
            <tbody>
              {r.methods.map((m) => (
                <tr key={m.name}>
                  <td className="font-medium">{m.name}</td>
                  <td><Share value={m.done} max={top} /></td>
                  <td className="text-right tabular-nums">{m.done}</td>
                  <td className="text-right tabular-nums">{pct(m.onTimeRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
