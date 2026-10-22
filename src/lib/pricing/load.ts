import "server-only";
import { db } from "@/lib/db";
import type { DecorationInput, LineItemInput, MethodPricing } from "./line-item";
import type { TaxRateInput } from "./order";

export interface DecorationRequest {
  methodId: string;
  location: string;
  colors?: number;
  stitches?: number;
  widthIn?: number;
  heightIn?: number;
  needsArtwork?: boolean;
  needsDigitizing?: boolean;
  reuseScreens?: boolean;
  requestProof?: boolean;
  /** Quantity for the price break when combined across lines (see DecorationInput). */
  pricingQty?: number;
}

export interface LineRequest {
  productId: string;
  colorId: string;
  /** sizeId → quantity */
  quantities: Record<string, number>;
  decorations: DecorationRequest[];
  /** Customer's pricing group; falls back to the default group. */
  pricingGroupId?: string | null;
}

export class LineRequestError extends Error {}

/**
 * Build pricing-engine input for one line from the database: variant costs,
 * the pricing group's markup, each method's price table (group-specific if
 * one exists, else default), product-level method overrides, and the
 * product's quantity discount.
 */
export async function loadLineItemInput(req: LineRequest): Promise<LineItemInput> {
  const product = await db.product.findUnique({
    where: { id: req.productId },
    include: {
      colors: true,
      sizes: true,
      variants: { where: { colorId: req.colorId, active: true } },
      methodRules: true,
      quantityDiscount: { include: { tiers: true } },
      productType: { include: { decorationMethods: true } },
    },
  });
  if (!product) throw new LineRequestError("Product not found");
  const color = product.colors.find((c) => c.id === req.colorId);
  if (!color) throw new LineRequestError("Color not found for this product");

  const group =
    (req.pricingGroupId && (await db.pricingGroup.findUnique({ where: { id: req.pricingGroupId }, include: { markupTiers: true } }))) ||
    (await db.pricingGroup.findFirst({ where: { isDefault: true }, include: { markupTiers: true } }));
  if (!group) throw new LineRequestError("No default pricing group is set up");

  const sizes = Object.entries(req.quantities)
    .filter(([, qty]) => qty > 0)
    .map(([sizeId, qty]) => {
      const size = product.sizes.find((s) => s.id === sizeId);
      const variant = product.variants.find((v) => v.sizeId === sizeId);
      if (!size || !variant) throw new LineRequestError(`${color.name} isn't offered in that size`);
      return { sizeCode: size.code, qty, wholesaleCost: variant.wholesaleCost.toString() };
    })
    .sort((a, b) => {
      const order = (code: string) => product.sizes.find((s) => s.code === code)?.sortOrder ?? 0;
      return order(a.sizeCode) - order(b.sizeCode);
    });

  const allowedMethodIds = new Set(product.productType.decorationMethods.map((d) => d.methodId));
  const decorations: DecorationInput[] = [];
  for (const d of req.decorations) {
    const method = await db.decorationMethod.findUnique({
      where: { id: d.methodId },
      include: { priceTables: { where: { OR: [{ pricingGroupId: group.id }, { pricingGroupId: null }] }, include: { cells: true } } },
    });
    const rule = product.methodRules.find((r) => r.methodId === d.methodId);
    if (!method || !method.active || !allowedMethodIds.has(method.id) || rule?.enabled === false) {
      throw new LineRequestError(`${method?.name ?? "That method"} isn't offered for ${product.name}`);
    }
    const table =
      method.priceTables.find((t) => t.pricingGroupId === group.id) ?? method.priceTables.find((t) => t.pricingGroupId === null);
    const pricing: MethodPricing = {
      code: method.code,
      name: method.name,
      pricingModel: method.pricingModel,
      minQty: Math.max(method.minQty, rule?.minQty ?? 0),
      maxColors: method.maxColors,
      screenSetupFee: method.screenSetupFee.toString(),
      chargeWhiteBaseScreen: method.chargeWhiteBaseScreen,
      useWhiteBaseOnDark: method.useWhiteBaseOnDark,
      artworkFee: method.artworkFee.toString(),
      digitizingFee: method.digitizingFee.toString(),
      digitizingFeePerInch: method.digitizingFeePerInch,
      proofingFee: method.proofingFee.toString(),
    };
    decorations.push({
      ...d,
      method: pricing,
      priceCells: (table?.cells ?? []).map((c) => ({
        minQty: c.minQty,
        dimensionMax: c.dimensionMax?.toString() ?? null,
        unitPrice: c.unitPrice.toString(),
      })),
    });
  }

  const settings = await db.shopSettings.findUnique({ where: { id: 1 } });
  return {
    sizes,
    garmentShade: color.shade,
    markup: {
      mode: group.markupMode,
      tiers: group.markupTiers.map((t) => ({
        costFrom: t.costFrom.toString(),
        costTo: t.costTo?.toString() ?? null,
        pct: t.pct.toString(),
      })),
    },
    quantityDiscountTiers: product.quantityDiscount?.tiers.map((t) => ({ minQty: t.minQty, pct: t.pct.toString() })) ?? [],
    decorations,
    rounding: settings?.priceRounding ?? "CENT",
    allowBlankSale: product.allowBlankSale,
  };
}

/** Active tax rates matching a ship-to address (country, state, ZIP). */
export async function loadTaxRates(address: { country: string; region?: string | null; postalCode?: string | null }): Promise<TaxRateInput[]> {
  const rates = await db.taxRate.findMany({ where: { active: true, country: address.country.toUpperCase() } });
  const region = address.region?.toUpperCase() ?? null;
  const zip = address.postalCode?.replace(/\s/g, "") ?? "";
  return rates
    .filter((r) => r.region === null || r.region === region)
    .filter((r) => r.postalPrefixes.length === 0 || r.postalPrefixes.some((p) => zip.startsWith(p)))
    .map((r) => ({ ...r, rate: r.rate.toString() }));
}
