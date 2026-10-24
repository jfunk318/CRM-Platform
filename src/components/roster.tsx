import { personalizationLabel } from "@/lib/store/personalization";

type Entry = { id: string; name: string; number: string; qty: number; size: { code: string; sortOrder: number } };

/** A line's names and numbers, by size, for staff and the work order. */
export function Roster({ names, className = "" }: { names: Entry[]; className?: string }) {
  if (names.length === 0) return null;
  const sorted = [...names].sort((a, b) => a.size.sortOrder - b.size.sortOrder || (Number(a.number) || 0) - (Number(b.number) || 0) || a.name.localeCompare(b.name));
  const pieces = names.reduce((n, e) => n + e.qty, 0);
  return (
    <div className={className} data-testid="roster">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Names &amp; numbers ({pieces})</div>
      <table className="mt-1 text-sm">
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id}>
              <td className="pr-3 text-gray-500">{e.size.code}</td>
              <td className="pr-3 font-medium">{personalizationLabel(e)}</td>
              <td className="text-gray-500">{e.qty > 1 ? `× ${e.qty}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
