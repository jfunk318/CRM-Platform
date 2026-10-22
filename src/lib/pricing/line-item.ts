import { D, Decimal, type DecimalLike, type PriceRounding, roundPrice, sum, toCents, ZERO } from "./money";
import {
  blankUnitPrice,
  lookupDecorationPrice,
  type MarkupMode,
  type MarkupTier,
  type PriceCell,
  PricingError,
  quantityDiscountPct,
  type QuantityDiscountTier,
} from "./tables";

export type GarmentShade = "WHITE" | "LIGHT" | "DARK";
export type DecorationPricingModel = "PER_COLOR" | "PER_STITCH" | "AREA" | "FLAT";

export type FeeType = "SCREEN_SETUP" | "ARTWORK" | "DIGITIZING" | "PROOFING";

export interface MethodPricing {
  code: string;
  name: string;
  pricingModel: DecorationPricingModel;
  minQty: number;
  maxColors?: number | null;
  screenSetupFee: DecimalLike;
  chargeWhiteBaseScreen: boolean;
  useWhiteBaseOnDark: boolean;
  artworkFee: DecimalLike;
  digitizingFee: DecimalLike;
  digitizingFeePerInch: boolean;
  proofingFee: DecimalLike;
}

export interface DecorationInput {
  /** Where it goes, for display: "Front / Full Front". */
  location: string;
  method: MethodPricing;
  priceCells: PriceCell[];
  /** Ink colors (PER_COLOR), stitch count (PER_STITCH), sq in (AREA); omit for FLAT. */
  colors?: number;
  stitches?: number;
  widthIn?: DecimalLike;
  heightIn?: DecimalLike;
  /** Customer asked the shop to create or clean up the artwork. */
  needsArtwork?: boolean;
  /** Embroidery file must be digitized. */
  needsDigitizing?: boolean;
  /** Screens already exist from a previous order (no setup fee). */
  reuseScreens?: boolean;
  requestProof?: boolean;
  /**
   * Quantity used for the decoration price break, when the same design is
   * combined across line items. Defaults to the line's total quantity.
   */
  pricingQty?: number;
}

export interface SizeQtyInput {
  sizeCode: string;
  qty: number;
  wholesaleCost: DecimalLike;
}

export interface LineItemInput {
  sizes: SizeQtyInput[];
  garmentShade: GarmentShade;
  markup: { mode: MarkupMode; tiers: MarkupTier[] };
  quantityDiscountTiers?: QuantityDiscountTier[];
  decorations: DecorationInput[];
  rounding?: PriceRounding;
  /** Blank-only sale: skip the garment if it can't be sold undecorated. */
  allowBlankSale?: boolean;
}

export interface PricingIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  location?: string;
}

export interface DecorationBreakdown {
  location: string;
  methodCode: string;
  unitPrice: Decimal;
}

export interface SizeBreakdown {
  sizeCode: string;
  qty: number;
  blankUnit: Decimal;
  decorationUnit: Decimal;
  discountPct: Decimal;
  unitPrice: Decimal;
  total: Decimal;
}

export interface Fee {
  type: FeeType;
  location: string;
  description: string;
  amount: Decimal;
}

export interface LineItemPrice {
  totalQty: number;
  sizes: SizeBreakdown[];
  decorations: DecorationBreakdown[];
  fees: Fee[];
  merchandiseTotal: Decimal;
  feesTotal: Decimal;
  total: Decimal;
  issues: PricingIssue[];
}

function decorationDimension(d: DecorationInput): DecimalLike | null {
  switch (d.method.pricingModel) {
    case "PER_COLOR":
      return d.colors ?? 1;
    case "PER_STITCH":
      return d.stitches ?? 0;
    case "AREA":
      return D(d.widthIn ?? 0).times(d.heightIn ?? 0);
    case "FLAT":
      return null;
  }
}

function screenCount(d: DecorationInput, shade: GarmentShade): number {
  const colors = d.colors ?? 1;
  const whiteBase =
    shade === "DARK" && d.method.useWhiteBaseOnDark && d.method.chargeWhiteBaseScreen ? 1 : 0;
  return colors + whiteBase;
}

function decorationFees(d: DecorationInput, shade: GarmentShade): Fee[] {
  const fees: Fee[] = [];
  const m = d.method;
  const add = (type: FeeType, description: string, amount: Decimal) => {
    if (amount.gt(0)) fees.push({ type, location: d.location, description, amount: toCents(amount) });
  };

  if (m.pricingModel === "PER_COLOR" && !d.reuseScreens) {
    const screens = screenCount(d, shade);
    add("SCREEN_SETUP", `${screens} screen${screens === 1 ? "" : "s"}`, D(m.screenSetupFee).times(screens));
  }
  if (d.needsArtwork) add("ARTWORK", "Artwork", D(m.artworkFee));
  if (d.needsDigitizing) {
    const longest = Decimal.max(D(d.widthIn ?? 0), D(d.heightIn ?? 0));
    const amount = m.digitizingFeePerInch ? D(m.digitizingFee).times(longest.ceil()) : D(m.digitizingFee);
    add("DIGITIZING", "Digitizing", amount);
  }
  if (d.requestProof) add("PROOFING", "Proof", D(m.proofingFee));
  return fees;
}

/** Price one product line: a garment color in several sizes with its decorations. */
export function priceLineItem(input: LineItemInput): LineItemPrice {
  const rounding = input.rounding ?? "CENT";
  const issues: PricingIssue[] = [];
  const sizes = input.sizes.filter((s) => s.qty > 0);
  const totalQty = sizes.reduce((n, s) => n + s.qty, 0);

  if (input.decorations.length === 0 && input.allowBlankSale === false) {
    issues.push({
      severity: "error",
      code: "BLANK_NOT_ALLOWED",
      message: "This product must be decorated",
    });
  }

  // Decoration unit prices (same for every size).
  const decorations: DecorationBreakdown[] = [];
  for (const d of input.decorations) {
    const qty = d.pricingQty ?? totalQty;
    if (qty < d.method.minQty) {
      issues.push({
        severity: "error",
        code: "BELOW_MIN_QTY",
        location: d.location,
        message: `${d.method.name} requires at least ${d.method.minQty} pieces`,
      });
    }
    if (d.method.pricingModel === "PER_COLOR" && d.method.maxColors && (d.colors ?? 1) > d.method.maxColors) {
      issues.push({
        severity: "error",
        code: "TOO_MANY_COLORS",
        location: d.location,
        message: `${d.method.name} allows at most ${d.method.maxColors} colors`,
      });
    }
    try {
      const unitPrice = lookupDecorationPrice(d.priceCells, Math.max(qty, 1), decorationDimension(d));
      decorations.push({ location: d.location, methodCode: d.method.code, unitPrice });
    } catch (e) {
      if (!(e instanceof PricingError)) throw e;
      issues.push({ severity: "error", code: e.code, location: d.location, message: e.message });
      decorations.push({ location: d.location, methodCode: d.method.code, unitPrice: ZERO });
    }
  }
  const decorationUnit = sum(decorations.map((d) => d.unitPrice));
  const discountPct = quantityDiscountPct(input.quantityDiscountTiers ?? [], totalQty);

  const sizeRows: SizeBreakdown[] = sizes.map((s) => {
    let blankUnit = ZERO;
    try {
      blankUnit = blankUnitPrice(s.wholesaleCost, input.markup.tiers, input.markup.mode);
    } catch (e) {
      if (!(e instanceof PricingError)) throw e;
      issues.push({ severity: "error", code: e.code, message: `${s.sizeCode}: ${e.message}` });
    }
    const beforeDiscount = blankUnit.plus(decorationUnit);
    const unitPrice = roundPrice(beforeDiscount.times(D(1).minus(discountPct)), rounding);
    return {
      sizeCode: s.sizeCode,
      qty: s.qty,
      blankUnit,
      decorationUnit,
      discountPct,
      unitPrice,
      total: toCents(unitPrice.times(s.qty)),
    };
  });

  const fees = input.decorations.flatMap((d) => decorationFees(d, input.garmentShade));
  const merchandiseTotal = sum(sizeRows.map((r) => r.total));
  const feesTotal = sum(fees.map((f) => f.amount));

  return {
    totalQty,
    sizes: sizeRows,
    decorations,
    fees,
    merchandiseTotal,
    feesTotal,
    total: merchandiseTotal.plus(feesTotal),
    issues,
  };
}
