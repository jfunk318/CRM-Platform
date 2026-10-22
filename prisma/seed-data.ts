// Beeze Tees starting configuration, taken from the settings the old storefront
// published to its design tool (see docs/SPEC.md §2–3). Decoration price
// tables were not visible there; the tables below are placeholders to be
// replaced in admin with Beeze's real prices.

export const shop = {
  shopName: "Beeze Tees",
  currency: "USD",
  priceRounding: "CENT" as const,
};

// Flat 40% markup on wholesale cost (price = cost × 1.40) for every product.
// Tiers stay editable in admin if cost-based tiers are wanted later.
export const defaultMarkupTiers = [{ costFrom: "0.00", costTo: null, pct: "0.40" }];

export const quantityDiscounts = [
  { name: "Small run 5/10", tiers: [{ minQty: 5, pct: "0" }, { minQty: 10, pct: "0" }] },
  { name: "Bulk 100+ (50%)", tiers: [{ minQty: 100, pct: "0.50" }] },
  {
    name: "Standard 3/5/10%",
    tiers: [
      { minQty: 5, pct: "0.03" },
      { minQty: 10, pct: "0.05" },
      { minQty: 15, pct: "0.10" },
    ],
  },
  { name: "20% at 5+", tiers: [{ minQty: 5, pct: "0.20" }] },
];

type Kind = "SCREEN_PRINT" | "EMBROIDERY" | "DTF" | "DIGITAL" | "VINYL" | "TRANSFER" | "ENGRAVING" | "OTHER";
type Model = "PER_COLOR" | "PER_STITCH" | "AREA" | "FLAT";

export interface MethodSeed {
  code: string;
  name: string;
  shortName: string;
  description?: string;
  kind: Kind;
  pricingModel: Model;
  minQty?: number;
  maxColors?: number;
  minDpi?: number;
  perfectDpi?: number;
  capabilities: Record<string, boolean>;
  /** Placeholder grid: [minQty, dimensionMax | null, unitPrice]. */
  placeholderPrices: [number, number | null, string][];
}

const textAndImages = {
  allowText: true,
  allowImages: true,
  allowImageUpload: true,
  allowTeamNames: false,
  allowTextEffects: true,
  allowTextWarp: true,
  allowTextOutline: true,
  allowGradients: true,
};

export const decorationMethods: MethodSeed[] = [
  {
    code: "DTF",
    name: "DTF No Minimum Printing: Full Color",
    shortName: "DTF",
    kind: "DTF",
    pricingModel: "AREA",
    minDpi: 150,
    perfectDpi: 300,
    capabilities: { ...textAndImages, allowTeamNames: true },
    placeholderPrices: [
      [1, 16, "6.00"], [1, 144, "9.00"], [1, 300, "12.00"],
      [24, 16, "4.50"], [24, 144, "7.00"], [24, 300, "9.50"],
    ],
  },
  {
    code: "DIG",
    name: "Full Color Digital Printing",
    shortName: "Digital",
    kind: "DIGITAL",
    pricingModel: "AREA",
    minDpi: 150,
    perfectDpi: 300,
    capabilities: textAndImages,
    placeholderPrices: [[1, 144, "10.00"], [1, 300, "14.00"]],
  },
  {
    code: "EMB",
    name: "Embroidery",
    shortName: "Embroidery",
    kind: "EMBROIDERY",
    pricingModel: "PER_STITCH",
    capabilities: { allowText: true, allowImages: true, allowImageUpload: true, allowTeamNames: false },
    placeholderPrices: [
      [1, 5000, "8.00"], [1, 10000, "11.00"], [1, 15000, "14.00"],
      [24, 5000, "6.00"], [24, 10000, "8.50"], [24, 15000, "11.00"],
    ],
  },
  {
    code: "SCR",
    name: "Screen Printing: 1-8 Colors",
    shortName: "Screen Printing",
    description: "Minimum = 12",
    kind: "SCREEN_PRINT",
    pricingModel: "PER_COLOR",
    minQty: 12,
    maxColors: 8,
    minDpi: 300,
    perfectDpi: 300,
    capabilities: { ...textAndImages, limitColorsToPalettes: true, trackUsedColors: true },
    placeholderPrices: [
      [12, 1, "3.00"], [12, 2, "3.75"], [12, 4, "5.00"], [12, 8, "7.00"],
      [48, 1, "2.00"], [48, 2, "2.50"], [48, 4, "3.50"], [48, 8, "5.00"],
      [144, 1, "1.25"], [144, 2, "1.60"], [144, 4, "2.25"], [144, 8, "3.25"],
    ],
  },
  {
    code: "VIN",
    name: "Vinyl Heat Transfer",
    shortName: "Vinyl",
    kind: "VINYL",
    pricingModel: "AREA",
    capabilities: { allowText: true, allowImages: true, allowImageUpload: true, allowTeamNames: true },
    placeholderPrices: [[1, 50, "5.00"], [1, 144, "8.00"]],
  },
  {
    code: "SPT",
    name: "Screen Printed Transfers",
    shortName: "Screen Transfers",
    kind: "TRANSFER",
    pricingModel: "AREA",
    capabilities: textAndImages,
    placeholderPrices: [[1, 144, "4.00"]],
  },
  {
    code: "PRT",
    name: "Printing",
    shortName: "Printing",
    kind: "OTHER",
    pricingModel: "FLAT",
    capabilities: textAndImages,
    placeholderPrices: [[1, null, "5.00"]],
  },
  {
    code: "ENG",
    name: "Engraving",
    shortName: "Engraving",
    kind: "ENGRAVING",
    pricingModel: "FLAT",
    capabilities: { allowText: true, allowImages: true, allowImageUpload: true },
    placeholderPrices: [[1, null, "8.00"]],
  },
];

export const suppliers = [
  { code: "sanmar", name: "SanMar", integration: "PROMOSTANDARDS" as const },
  { code: "ss", name: "S&S Activewear", integration: "REST_API" as const },
  { code: "charles-river", name: "Charles River Apparel", integration: "CSV" as const },
  { code: "pennant", name: "Pennant", integration: "CSV" as const },
];

export const categories: { slug: string; name: string; parent?: string }[] = [
  { slug: "t-shirts", name: "T-Shirts" },
  { slug: "t-shirts-mens", name: "Mens", parent: "t-shirts" },
  { slug: "t-shirts-ladies", name: "Ladies", parent: "t-shirts" },
  { slug: "t-shirts-long-sleeve", name: "Long Sleeve", parent: "t-shirts" },
  { slug: "t-shirts-performance", name: "Performance", parent: "t-shirts" },
  { slug: "t-shirts-v-necks", name: "V-Necks", parent: "t-shirts" },
  { slug: "t-shirts-tanks", name: "Tanks", parent: "t-shirts" },
  { slug: "t-shirts-toddler", name: "Toddler", parent: "t-shirts" },
  { slug: "sweatshirts", name: "Sweatshirts" },
  { slug: "sweatshirts-crew", name: "Crew", parent: "sweatshirts" },
  { slug: "sweatshirts-hooded", name: "Hooded", parent: "sweatshirts" },
  { slug: "sweatshirts-full-zip", name: "Full-Zip", parent: "sweatshirts" },
  { slug: "sweatshirts-quarter-zip", name: "1/4 Zip", parent: "sweatshirts" },
];

// Starting statuses; editable in admin to match how staff divide the work.
export const orderStatuses: {
  type: "QUOTE" | "ORDER";
  name: string;
  color: string;
  isDefault?: boolean;
  isClosed?: boolean;
  isConversion?: boolean;
}[] = [
  { type: "QUOTE", name: "Draft", color: "#9CA3AF", isDefault: true },
  { type: "QUOTE", name: "Sent", color: "#3B82F6" },
  { type: "QUOTE", name: "Approved", color: "#10B981" },
  { type: "QUOTE", name: "Declined", color: "#EF4444", isClosed: true },
  { type: "QUOTE", name: "Converted to order", color: "#6366F1", isClosed: true, isConversion: true },
  { type: "ORDER", name: "New", color: "#3B82F6", isDefault: true },
  { type: "ORDER", name: "Awaiting artwork", color: "#F59E0B" },
  { type: "ORDER", name: "Artwork approved", color: "#14B8A6" },
  { type: "ORDER", name: "Ordering blanks", color: "#8B5CF6" },
  { type: "ORDER", name: "In production", color: "#F97316" },
  { type: "ORDER", name: "Ready for pickup / shipping", color: "#22C55E" },
  { type: "ORDER", name: "Completed", color: "#6B7280", isClosed: true },
  { type: "ORDER", name: "Cancelled", color: "#EF4444", isClosed: true },
];
