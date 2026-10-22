import { Prisma } from "@prisma/client";
import { decimal, FormError, int, optionalDecimal, percent } from "./form";

const isBlankRow = (...values: string[]) => values.every((v) => v.trim() === "");

export type MarkupTierData = { costFrom: Prisma.Decimal; costTo: Prisma.Decimal | null; pct: Prisma.Decimal };

/**
 * Markup tiers must start at $0, not overlap or leave gaps, and only the last
 * tier may be open-ended.
 */
export function parseMarkupTiers(costFrom: string[], costTo: string[], pct: string[]): MarkupTierData[] {
  const tiers = costFrom
    .map((_, i) => ({ from: costFrom[i], to: costTo[i] ?? "", pct: pct[i] ?? "" }))
    .filter((r) => !isBlankRow(r.from, r.to, r.pct))
    .map((r, i) => ({
      costFrom: decimal(r.from, `Tier ${i + 1} cost from`),
      costTo: optionalDecimal(r.to, `Tier ${i + 1} cost to`),
      pct: percent(r.pct, `Tier ${i + 1} markup`),
    }))
    .sort((a, b) => a.costFrom.cmp(b.costFrom));

  if (tiers.length === 0) throw new FormError("Add at least one markup tier");
  if (!tiers[0].costFrom.isZero()) throw new FormError("The first tier must start at $0.00");
  tiers.forEach((t, i) => {
    const label = `Tier starting at $${t.costFrom.toFixed(2)}`;
    if (t.costTo && t.costTo.lt(t.costFrom)) throw new FormError(`${label} ends before it starts`);
    const next = tiers[i + 1];
    if (!next) return;
    if (t.costTo === null) throw new FormError("Only the last tier can have no upper limit");
    if (next.costFrom.lte(t.costTo)) throw new FormError(`${label} overlaps the next tier`);
    if (next.costFrom.minus(t.costTo).gt("0.01")) {
      throw new FormError(`Gap between $${t.costTo.toFixed(2)} and $${next.costFrom.toFixed(2)}`);
    }
  });
  if (tiers[tiers.length - 1].costTo !== null) {
    throw new FormError("Leave the last tier's upper limit blank so every cost is covered");
  }
  return tiers;
}

export type DiscountTierData = { minQty: number; pct: Prisma.Decimal };

export function parseDiscountTiers(minQty: string[], pct: string[]): DiscountTierData[] {
  const tiers = minQty
    .map((_, i) => ({ q: minQty[i], p: pct[i] ?? "" }))
    .filter((r) => !isBlankRow(r.q, r.p))
    .map((r, i) => ({ minQty: int(r.q, `Row ${i + 1} quantity`), pct: percent(r.p, `Row ${i + 1} discount`) }))
    .sort((a, b) => a.minQty - b.minQty);
  if (tiers.length === 0) throw new FormError("Add at least one quantity break");
  const dup = tiers.find((t, i) => i > 0 && tiers[i - 1].minQty === t.minQty);
  if (dup) throw new FormError(`Quantity ${dup.minQty} is listed twice`);
  return tiers;
}

export type PriceCellData = { minQty: number; dimensionMax: Prisma.Decimal | null; unitPrice: Prisma.Decimal };

/** Parse the JSON from <PriceGridEditor>. Blank cells are left out. */
export function parsePriceGrid(json: string, flat: boolean): PriceCellData[] {
  let grid: { quantities: string[]; dimensions: string[]; prices: string[][] };
  try {
    grid = JSON.parse(json);
  } catch {
    throw new FormError("Price table data was unreadable; reload and try again");
  }
  const quantities = grid.quantities.map((q, r) => int(q, `Row ${r + 1} minimum quantity`));
  if (quantities.some((q) => q < 1)) throw new FormError("Minimum quantities must be at least 1");
  if (new Set(quantities).size !== quantities.length) throw new FormError("Each quantity break must be different");

  const dimensions = flat
    ? [null]
    : grid.dimensions.map((d, c) => decimal(d, `Column ${c + 1} "up to" value`));
  if (!flat && new Set(dimensions.map((d) => d!.toString())).size !== dimensions.length) {
    throw new FormError("Each column's \"up to\" value must be different");
  }

  const cells: PriceCellData[] = [];
  quantities.forEach((minQty, r) =>
    dimensions.forEach((dimensionMax, c) => {
      const raw = grid.prices[r]?.[c] ?? "";
      if (raw.trim() === "") return;
      cells.push({ minQty, dimensionMax, unitPrice: decimal(raw, `Price at qty ${minQty}`) });
    }),
  );
  if (cells.length === 0) throw new FormError("Enter at least one price");
  return cells;
}
