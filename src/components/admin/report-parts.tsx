import Link from "next/link";
import { PERIODS, type Period } from "@/lib/reports/reports";

// Building blocks for the Reporting pages.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const money = (n: number) => usd.format(n);
export const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

const PERIOD_LABELS: Record<Period, string> = { 30: "Last 30 days", 90: "Last 90 days", 365: "Last 12 months" };

/** The page heading with the period picker. */
export function ReportHeader({ title, intro, period, path }: { title: string; intro: string; period: Period; path: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{intro}</p>
      </div>
      <nav className="flex gap-1 rounded-lg bg-gray-200/70 p-1 text-sm" aria-label="Period" data-testid="period">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={p === 90 ? path : `${path}?days=${p}`}
            aria-current={p === period ? "true" : undefined}
            className={`rounded-md px-3 py-1 ${p === period ? "bg-white font-medium shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** A headline number, with its change from the period before. */
export function Kpi({ label, value, change, note, highlight }: { label: string; value: string; change?: number | null; note?: string; highlight?: boolean }) {
  const up = change != null && change >= 0;
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white"}`} data-testid="kpi">
      <div className={`text-sm font-medium ${highlight ? "text-brand-100" : "text-gray-600"}`}>{label}</div>
      <div className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      {change != null && (
        <div className={`mt-1 text-xs font-medium ${highlight ? "text-brand-100" : up ? "text-green-700" : "text-red-700"}`}>
          {up ? "▲" : "▼"} {Math.abs(Math.round(change * 100))}% vs the period before
        </div>
      )}
      {note && <div className={`mt-1 text-xs ${highlight ? "text-brand-100" : "text-gray-500"}`}>{note}</div>}
    </div>
  );
}

/** A simple column chart; the latest column in plum, the rest muted. */
export function Columns({ data, format, label }: { data: { label: string; value: number }[]; format: (n: number) => string; label: string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <figure className="card" aria-label={label}>
      <figcaption className="mb-4 text-sm font-semibold text-gray-900">{label}</figcaption>
      <div className="flex h-44 items-end gap-2" role="list">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" role="listitem" title={`${d.label}: ${format(d.value)}`}>
            <span className="hidden text-[11px] text-gray-500 tabular-nums sm:block">{d.value ? format(d.value) : ""}</span>
            <div
              className={`w-full rounded-t-md ${i === data.length - 1 ? "bg-brand-600" : "bg-brand-200"}`}
              style={{ height: `${max ? Math.max(2, (d.value / max) * 100) : 2}%` }}
            />
            <span className="truncate text-[11px] text-gray-500">{d.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** A horizontal bar to show a row's share next to its number. */
export function Share({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-full min-w-16 rounded-full bg-gray-100" aria-hidden="true">
      <div className="h-2 rounded-full bg-green-600" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}
