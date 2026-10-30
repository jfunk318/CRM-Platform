/** Daily visits as a small bar chart (oldest on the left). */
export function VisitBars({ daily, className = "" }: { daily: number[]; className?: string }) {
  const max = Math.max(1, ...daily);
  return (
    <div className={`flex h-12 items-end gap-px ${className}`} role="img" aria-label={`Visits per day over the last ${daily.length} days, up to ${max} a day`}>
      {daily.map((v, i) => (
        <div key={i} className={v ? "flex-1 rounded-t-sm bg-brand-400" : "flex-1 bg-gray-100"} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={`${v} visit${v === 1 ? "" : "s"}`} />
      ))}
    </div>
  );
}
