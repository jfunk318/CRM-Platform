"use client";

import { useState } from "react";

export type GridValue = {
  /** Minimum quantity for each row. */
  quantities: string[];
  /** "Up to" value for each column; a single "" column for flat pricing. */
  dimensions: string[];
  /** prices[row][col]; "" = no price for that combination. */
  prices: string[][];
};

/**
 * Spreadsheet-style editor for a decoration price table: quantity breaks down
 * the side, colors / stitches / square inches across the top. Submits the
 * grid as JSON in a hidden input named `grid`.
 */
export function PriceGridEditor({
  initial,
  dimensionLabel,
}: {
  initial: GridValue;
  /** e.g. "colors", "stitches", "sq in"; null for flat pricing (one column). */
  dimensionLabel: string | null;
}) {
  const [g, setG] = useState<GridValue>(initial);
  const flat = dimensionLabel === null;

  const setCell = (r: number, c: number, v: string) =>
    setG((s) => ({ ...s, prices: s.prices.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) }));

  const addRow = () =>
    setG((s) => ({ ...s, quantities: [...s.quantities, ""], prices: [...s.prices, s.dimensions.map(() => "")] }));
  const removeRow = (r: number) =>
    setG((s) => ({ ...s, quantities: s.quantities.filter((_, i) => i !== r), prices: s.prices.filter((_, i) => i !== r) }));
  const addCol = () =>
    setG((s) => ({ ...s, dimensions: [...s.dimensions, ""], prices: s.prices.map((row) => [...row, ""]) }));
  const removeCol = (c: number) =>
    setG((s) => ({
      ...s,
      dimensions: s.dimensions.filter((_, j) => j !== c),
      prices: s.prices.map((row) => row.filter((_, j) => j !== c)),
    }));

  return (
    <div className="space-y-2">
      <input type="hidden" name="grid" value={JSON.stringify(g)} />
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="px-1 py-1 text-left text-xs font-semibold text-gray-500">Min qty ↓</th>
              {g.dimensions.map((d, c) => (
                <th key={c} className="px-1 py-1">
                  {flat ? (
                    <span className="text-xs font-semibold text-gray-500">Price each</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">up to</span>
                      <input
                        className="input w-20"
                        aria-label={`Column ${c + 1} up to ${dimensionLabel}`}
                        value={d}
                        onChange={(e) => setG((s) => ({ ...s, dimensions: s.dimensions.map((x, j) => (j === c ? e.target.value : x)) }))}
                      />
                      <span className="text-xs text-gray-500">{dimensionLabel}</span>
                      {g.dimensions.length > 1 && (
                        <button type="button" aria-label="Remove column" className="text-gray-400 hover:text-red-600" onClick={() => removeCol(c)}>✕</button>
                      )}
                    </div>
                  )}
                </th>
              ))}
              {!flat && (
                <th className="px-1">
                  <button type="button" className="btn-secondary" onClick={addCol}>+ Column</button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {g.quantities.map((q, r) => (
              <tr key={r}>
                <td className="px-1 py-1">
                  <input
                    className="input w-20"
                    aria-label={`Row ${r + 1} minimum quantity`}
                    value={q}
                    onChange={(e) => setG((s) => ({ ...s, quantities: s.quantities.map((x, i) => (i === r ? e.target.value : x)) }))}
                  />
                </td>
                {g.dimensions.map((_, c) => (
                  <td key={c} className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">$</span>
                      <input
                        className="input w-24"
                        aria-label={`Price for row ${r + 1} column ${c + 1}`}
                        value={g.prices[r]?.[c] ?? ""}
                        onChange={(e) => setCell(r, c, e.target.value)}
                      />
                    </div>
                  </td>
                ))}
                <td className="px-1">
                  <button type="button" aria-label="Remove row" className="text-gray-400 hover:text-red-600" onClick={() => removeRow(r)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-secondary" onClick={addRow}>+ Quantity break</button>
    </div>
  );
}
