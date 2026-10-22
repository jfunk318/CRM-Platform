import type { DecorationKind, DecorationPricingModel } from "@prisma/client";

/** Design-tool options stored in DecorationMethod.capabilities. */
export const CAPABILITIES = {
  allowText: "Customers can add text",
  allowImages: "Customers can add clip art / images",
  allowImageUpload: "Customers can upload artwork",
  allowTeamNames: "Team names & numbers",
  allowTextEffects: "Text effects",
  allowTextWarp: "Text warp / arc",
  allowTextOutline: "Text outline",
  allowGradients: "Gradients",
  limitColorsToPalettes: "Limit colors to shop palettes",
  trackUsedColors: "Count ink colors used",
} as const;

export type CapabilityKey = keyof typeof CAPABILITIES;

export const KIND_LABELS: Record<DecorationKind, string> = {
  SCREEN_PRINT: "Screen printing",
  EMBROIDERY: "Embroidery",
  DTF: "DTF",
  DIGITAL: "Digital / DTG",
  VINYL: "Vinyl",
  TRANSFER: "Transfer",
  ENGRAVING: "Engraving",
  OTHER: "Other",
};

export const PRICING_MODEL_LABELS: Record<DecorationPricingModel, string> = {
  PER_COLOR: "By number of ink colors",
  PER_STITCH: "By stitch count",
  AREA: "By artwork size (sq in)",
  FLAT: "Flat price by quantity",
};

/** Column unit shown in the price grid editor; null = single flat column. */
export const DIMENSION_UNIT: Record<DecorationPricingModel, string | null> = {
  PER_COLOR: "colors",
  PER_STITCH: "stitches",
  AREA: "sq in",
  FLAT: null,
};
