import { D, Decimal, type DecimalLike } from "./money";

export class PricingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_MARKUP_TIER"
      | "NO_PRICE_ROW"
      | "DIMENSION_TOO_LARGE"
      | "DIMENSION_REQUIRED"
      | "BELOW_MIN_QTY",
  ) {
    super(message);
    this.name = "PricingError";
  }
}

// ─── Blank garment markup ───────────────────────────────────────────────────

export type MarkupMode = "MARKUP" | "MARGIN";

export interface MarkupTier {
  costFrom: DecimalLike;
  /** Inclusive upper bound; null = no upper bound. */
  costTo: DecimalLike | null;
  /** 0.55 = 55% */
  pct: DecimalLike;
}

/**
 * Selling price of a blank garment from its wholesale cost.
 * MARKUP: cost × (1 + pct). MARGIN: cost ÷ (1 − pct).
 */
export function blankUnitPrice(
  cost: DecimalLike,
  tiers: MarkupTier[],
  mode: MarkupMode = "MARKUP",
): Decimal {
  const c = D(cost);
  const tier = tiers.find(
    (t) => c.gte(t.costFrom) && (t.costTo === null || c.lte(t.costTo)),
  );
  if (!tier) {
    throw new PricingError(`No markup tier covers cost ${c.toFixed(2)}`, "NO_MARKUP_TIER");
  }
  const pct = D(tier.pct);
  return mode === "MARKUP" ? c.times(pct.plus(1)) : c.dividedBy(D(1).minus(pct));
}

// ─── Decoration price grid ──────────────────────────────────────────────────

export interface PriceCell {
  minQty: number;
  /** Up to N colors / stitches / sq in. null for FLAT tables. */
  dimensionMax: DecimalLike | null;
  unitPrice: DecimalLike;
}

/**
 * Look up a decoration unit price: the row with the largest minQty ≤ qty,
 * then the column with the smallest dimensionMax ≥ dimension.
 * Pass dimension = null for FLAT tables.
 */
export function lookupDecorationPrice(
  cells: PriceCell[],
  qty: number,
  dimension: DecimalLike | null,
): Decimal {
  const rowQty = cells
    .map((c) => c.minQty)
    .filter((m) => m <= qty)
    .reduce<number | null>((best, m) => (best === null || m > best ? m : best), null);
  if (rowQty === null) {
    throw new PricingError(`No decoration price for quantity ${qty}`, "NO_PRICE_ROW");
  }
  const row = cells.filter((c) => c.minQty === rowQty);

  if (dimension === null) {
    const flat = row.find((c) => c.dimensionMax === null) ?? row[0];
    return D(flat.unitPrice);
  }

  const dim = D(dimension);
  const candidates = row
    .filter((c) => c.dimensionMax !== null && dim.lte(c.dimensionMax))
    .sort((a, b) => D(a.dimensionMax!).cmp(b.dimensionMax!));
  if (candidates.length === 0) {
    if (row.every((c) => c.dimensionMax === null)) {
      throw new PricingError("This price table needs no dimension", "DIMENSION_REQUIRED");
    }
    throw new PricingError(
      `Decoration size/colors ${dim.toString()} exceeds the price table`,
      "DIMENSION_TOO_LARGE",
    );
  }
  return D(candidates[0].unitPrice);
}

// ─── Quantity breaks ────────────────────────────────────────────────────────

export interface QuantityDiscountTier {
  minQty: number;
  /** 0.10 = 10% off */
  pct: DecimalLike;
}

export function quantityDiscountPct(tiers: QuantityDiscountTier[], qty: number): Decimal {
  const tier = tiers
    .filter((t) => t.minQty <= qty)
    .sort((a, b) => b.minQty - a.minQty)[0];
  return tier ? D(tier.pct) : D(0);
}
