import type { Prisma } from "@prisma/client";
import { DesignMockups } from "@/components/design-mockups";
import { Roster } from "@/components/roster";
import type { DesignMockup } from "@/lib/design/mockups";

type Line = Prisma.OrderLineGetPayload<{
  include: {
    sizes: { include: { size: true } };
    design: { include: { product: true; color: true; decorations: { include: { method: true } } } };
  };
}> & { names?: Prisma.OrderLineNameGetPayload<{ include: { size: true } }>[] };

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;

/**
 * Items as the customer sees them: mockups of placed artwork, product,
 * sizes and prices, decorations, setup fees. `artBase` is the customer's
 * link for loading artwork.
 */
export function OrderItems({ lines, mockups, artBase }: { lines: Line[]; mockups?: Map<string, DesignMockup[]>; artBase?: string }) {
  return (
    <div className="space-y-3">
      {lines.map((line) => {
        const fees = line.fees as unknown as { location: string; description: string; amount: string }[];
        const qty = line.sizes.reduce((n, s) => n + s.qty, 0);
        return (
          <div key={line.id} className="card space-y-2 break-inside-avoid">
            {mockups?.get(line.designId) && artBase && <DesignMockups mockups={mockups.get(line.designId)!} artBase={artBase} className="w-40 sm:w-48" />}
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-medium">{line.design.product.name}</div>
                <div className="text-sm text-gray-600">
                  {line.design.color.name} · {qty} pcs
                </div>
              </div>
              <div className="font-semibold">{money(line.total)}</div>
            </div>
            <table className="text-sm">
              <tbody>
                <tr className="text-xs text-gray-500">
                  <td className="pr-4">Size</td>
                  {line.sizes.map((s) => <td key={s.id} className="px-2">{s.size.code}</td>)}
                </tr>
                <tr>
                  <td className="pr-4 text-xs text-gray-500">Qty</td>
                  {line.sizes.map((s) => <td key={s.id} className="px-2">{s.qty}</td>)}
                </tr>
                <tr>
                  <td className="pr-4 text-xs text-gray-500">Each</td>
                  {line.sizes.map((s) => <td key={s.id} className="px-2">{money(s.unitPrice)}</td>)}
                </tr>
              </tbody>
            </table>
            {line.names && <Roster names={line.names} />}
            {line.design.decorations.length > 0 ? (
              <ul className="text-sm text-gray-700">
                {line.design.decorations.map((d) => (
                  <li key={d.id}>
                    {d.location}: {d.method.shortName}
                    {d.colors ? `, ${d.colors} color${d.colors === 1 ? "" : "s"}` : ""}
                    {d.widthIn && d.heightIn ? `, ${d.widthIn.toString()}″ × ${d.heightIn.toString()}″` : ""}
                    {d.inkColors.length ? ` (${d.inkColors.join(", ")})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No decoration</p>
            )}
            {fees.filter((f) => Number(f.amount) > 0).length > 0 && (
              <ul className="text-sm text-gray-600">
                {fees
                  .filter((f) => Number(f.amount) > 0)
                  .map((f, i) => (
                    <li key={i}>
                      {f.location} {f.description.toLowerCase()}: {money(Number(f.amount))}
                    </li>
                  ))}
              </ul>
            )}
            {line.notes && <p className="text-sm italic text-gray-600">{line.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
