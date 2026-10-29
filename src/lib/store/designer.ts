import "server-only";
import { Prisma, type Store } from "@prisma/client";
import sharp from "sharp";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { DEFAULT_STITCH_DENSITY, estimateStitches, guidesFrom, type PlacementGuide } from "@/lib/design/guides";
import { dpiRating, effectiveDpi, printSize } from "@/lib/design/placement";
import { fileStore } from "@/lib/files/storage";
import { sizeRank } from "@/lib/catalog/sizes";
import { OrderError, type DecorationSpec } from "@/lib/orders/service";
import { basePricesFor } from "./items";
import { itemPrice } from "./settings";

// The online designer for shoppers: what a store lets them do (within what
// the business allows), the garments they can choose, prices for their
// design, and checking a design before it goes in the cart.

export type DesignerConfig = {
  enabled: boolean;
  upload: boolean;
  text: boolean;
  library: boolean;
  anyGarment: boolean;
  /** Methods shoppers may choose here: the business's shopper methods, narrowed by the store. */
  methods: { id: string; name: string; pricingModel: string; minQty: number; maxColors: number | null; minDpi: number | null; perfectDpi: number | null; stitchDensity: number }[];
};

/** What the store's designer offers; disabled if no method is open to shoppers. */
export async function designerConfig(db: BusinessDb | BusinessTx, store: Store): Promise<DesignerConfig> {
  const all = await db.decorationMethod.findMany({ where: { active: true, shopperDesign: true }, orderBy: { sortOrder: "asc" } });
  const methods = all
    .filter((m) => store.designerMethodIds.length === 0 || store.designerMethodIds.includes(m.id))
    .map((m) => ({ id: m.id, name: m.shortName, pricingModel: m.pricingModel, minQty: m.minQty, maxColors: m.maxColors, minDpi: m.minDpi, perfectDpi: m.perfectDpi, stitchDensity: m.stitchDensity }));
  return {
    enabled: store.designerEnabled && methods.length > 0 && (store.designerUpload || store.designerText || store.designerLibrary),
    upload: store.designerUpload,
    text: store.designerText,
    library: store.designerLibrary && !!store.customerId,
    anyGarment: store.designerAnyGarment,
    methods,
  };
}

const productInclude = {
  colors: { orderBy: { sortOrder: "asc" } },
  sizes: { orderBy: { sortOrder: "asc" } },
  variants: { where: { active: true }, select: { colorId: true, sizeId: true } },
  views: { orderBy: { sortOrder: "asc" }, include: { areas: true, images: true } },
  methodRules: true,
  productType: { include: { decorationMethods: true } },
} satisfies Prisma.ProductInclude;
type DesignerProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Which of the designer's methods a product takes (its type's methods, less any switched off for it). */
const methodsFor = (p: DesignerProductRow, config: DesignerConfig) => {
  const typeMethods = new Set(p.productType.decorationMethods.map((d) => d.methodId));
  return config.methods
    .filter((m) => typeMethods.has(m.id) && p.methodRules.find((r) => r.methodId === m.id)?.enabled !== false)
    .map((m) => ({ ...m, minQty: Math.max(m.minQty, p.methodRules.find((r) => r.methodId === m.id)?.minQty ?? 0) }));
};

/** A product shoppers can design on: active, with print areas, a photo, and a method the designer offers. */
const designable = (p: DesignerProductRow, config: DesignerConfig) =>
  p.status === "ACTIVE" && p.views.some((v) => v.areas.length > 0 && v.images.length > 0) && methodsFor(p, config).length > 0 && p.variants.length > 0;

async function garmentRows(db: BusinessDb, store: Store, config: DesignerConfig, where: Prisma.ProductWhereInput = {}) {
  const scope: Prisma.ProductWhereInput = config.anyGarment
    ? { status: "ACTIVE" }
    : { designs: { some: { storeItems: { some: { storeId: store.id, published: true } } } } };
  const rows = await db.product.findMany({ where: { AND: [scope, where] }, include: productInclude, orderBy: { name: "asc" }, take: 500 });
  return rows.filter((p) => designable(p, config));
}

/** Garments to pick from on /design. */
export async function designerGarments(db: BusinessDb, store: Store, config: DesignerConfig) {
  const rows = await garmentRows(db, store, config);
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    styleCode: p.styleCode,
    image: p.views.flatMap((v) => v.images).find((i) => /^https:\/\//.test(i.url))?.url ?? null,
    colors: p.colors.filter((c) => p.variants.some((v) => v.colorId === c.id)).map((c) => ({ name: c.name, hex: c.hex })),
  }));
}

export type DesignerProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  colors: { id: string; name: string; hex: string | null; sizeIds: string[] }[];
  sizes: { id: string; code: string }[];
  views: { id: string; name: string; photos: Record<string, string> }[];
  areas: { id: string; label: string; viewId: string; widthIn: number; heightIn: number; x: number; y: number; w: number; h: number }[];
  methods: DesignerConfig["methods"];
  guides: PlacementGuide[];
};

/** Everything the designer page needs for one garment, or null if shoppers can't design on it here. */
export async function designerProduct(db: BusinessDb, store: Store, config: DesignerConfig, by: { slug?: string; id?: string }): Promise<DesignerProduct | null> {
  const [p] = await garmentRows(db, store, config, by.slug ? { slug: by.slug } : { id: by.id });
  if (!p) return null;
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    colors: p.colors.flatMap((c) => {
      const sizeIds = p.variants.filter((v) => v.colorId === c.id).map((v) => v.sizeId);
      return sizeIds.length ? [{ id: c.id, name: c.name, hex: c.hex, sizeIds }] : [];
    }),
    sizes: p.sizes.filter((s) => p.variants.some((v) => v.sizeId === s.id)).map((s) => ({ id: s.id, code: s.code })).sort((a, b) => sizeRank(a.code) - sizeRank(b.code)),
    // Only views shoppers can see and print on.
    views: p.views.filter((v) => v.images.length).map((v) => ({ id: v.id, name: v.name, photos: Object.fromEntries(v.images.map((i) => [i.colorId, i.url])) })),
    areas: p.views
      .filter((v) => v.images.length)
      .flatMap((v) => v.areas.map((a) => ({ id: a.id, label: `${v.name} / ${a.name}`, viewId: v.id, widthIn: a.widthIn.toNumber(), heightIn: a.heightIn.toNumber(), x: a.x, y: a.y, w: a.w, h: a.h }))),
    methods: methodsFor(p, config),
    guides: guidesFrom(business.placementGuides),
  };
}

/** The store owner's artwork (team logos) shoppers can use, if the store allows it. */
export async function designerLibrary(db: BusinessDb, store: Store, config: DesignerConfig) {
  if (!config.library || !store.customerId) return [];
  const customer = await db.customer.findUnique({ where: { id: store.customerId } });
  if (!customer) return [];
  const assets = await db.artworkAsset.findMany({
    where: { OR: [{ customerId: customer.id }, ...(customer.companyId ? [{ companyId: customer.companyId }] : [])], file: { contentType: { in: ["image/png", "image/jpeg", "image/gif", "image/webp"] } } },
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 60,
  });
  return assets.map((a) => ({ fileId: a.fileId, name: a.name }));
}

// ─── Prices ─────────────────────────────────────────────────────────────

export type ShopperDecoration = { methodId: string; location: string; colors?: number | null; stitches?: number | null; widthIn?: number | null; heightIn?: number | null };

/**
 * A shopper's price per size for their design: the garment and decoration
 * at the quantity they're buying (one-time setup spread over the pieces),
 * plus the store's markup. With no quantities yet, an example run is priced.
 */
export async function shopperPrices(
  db: BusinessDb,
  store: Store & { group?: { markupKind: Store["markupKind"]; markupValue: Store["markupValue"] } | null },
  o: { productId: string; colorId: string; quantities: Record<string, number>; decorations: ShopperDecoration[]; minQty: number },
) {
  const entered = Object.entries(o.quantities).filter(([, q]) => q > 0);
  const qty = entered.reduce((n, [, q]) => n + q, 0);
  const example = qty === 0;
  const runQty = example ? Math.max(o.minQty, 12) : qty;
  const sizeIds = example
    ? (await db.productVariant.findMany({ where: { productId: o.productId, colorId: o.colorId, active: true }, select: { sizeId: true } })).map((v) => v.sizeId)
    : entered.map(([id]) => id);
  const decorations: DecorationSpec[] = o.decorations.map((d) => ({ ...d, colors: d.colors ?? null, stitches: d.stitches ?? null, widthIn: d.widthIn ?? null, heightIn: d.heightIn ?? null }));
  let base;
  try {
    base = await basePricesFor(db, { productId: o.productId, colorId: o.colorId, sizeIds, decorations, batchQty: runQty });
  } catch (e) {
    // Past the end of a price table: too many stitches or colors, or too big.
    if (e instanceof OrderError && /exceeds the price table/.test(e.message)) {
      throw new OrderError("That design is bigger or more detailed than we can price online. Make it smaller (or use fewer colors), or ask us for a quote.");
    }
    throw e;
  }
  const noMarkup = { markupKind: null, markupValue: null };
  const unit = new Map([...base].map(([sizeId, b]) => [sizeId, itemPrice({ basePrice: b, overridePrice: null }, noMarkup, store)]));
  const total = example ? null : entered.reduce((t, [sizeId, q]) => t.plus((unit.get(sizeId) ?? new Prisma.Decimal(0)).times(q)), new Prisma.Decimal(0));
  return { unit, qty: runQty, example, total };
}

// ─── Checking a design ──────────────────────────────────────────────────

/** Share of an image that's not transparent, worked out on a small copy. */
export async function fileCoverage(db: BusinessDb, fileId: string): Promise<number> {
  const file = await db.storedFile.findUniqueOrThrow({ where: { id: fileId } });
  const { data } = await sharp(await fileStore.get(file.storageKey)).resize(200, 200, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let solid = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 32) solid++;
  return Math.round((solid / (data.length / 4)) * 1000) / 1000;
}

/**
 * Re-check a shopper's decorations against the garment and the store's
 * rules, from the facts that can't be trusted to the browser: the area is
 * this product's, the method is offered, the artwork is theirs (uploaded
 * from this cart) or the store's, the printed size comes from the placement,
 * and embroidery stitches from the artwork itself. Low resolution needs
 * the shopper's OK.
 */
export async function checkShopperDesign(
  db: BusinessDb,
  o: { product: DesignerProduct; cartId: string | null; libraryFileIds: string[]; decorations: DecorationSpec[]; lowResOk: boolean },
): Promise<DecorationSpec[]> {
  if (o.decorations.length === 0) throw new OrderError("Add your artwork to at least one spot");
  if (o.decorations.length > 6) throw new OrderError("That's too many decorations for one item");
  const areaIds = new Set<string>();
  const out: DecorationSpec[] = [];
  for (const d of o.decorations) {
    const area = o.product.areas.find((a) => a.id === d.areaId);
    if (!area) throw new OrderError("Choose where your artwork goes");
    if (areaIds.has(area.id)) throw new OrderError(`Only one design per spot (${area.label})`);
    areaIds.add(area.id);
    const method = o.product.methods.find((m) => m.id === d.methodId);
    if (!method) throw new OrderError("That decoration isn't offered here");
    const art = d.artwork;
    if (!art) throw new OrderError(`Add artwork to ${area.label}`);
    const files = [art.artworkFileId, art.sourceFileId].filter((x): x is string => !!x);
    const own = o.cartId ? await db.cartFile.count({ where: { cartId: o.cartId, fileId: { in: files } } }) : 0;
    const shared = files.filter((f) => o.libraryFileIds.includes(f)).length;
    if (own + shared < files.length) throw new OrderError("That artwork isn't available; add it again");
    const size = printSize(area, art, art);
    const widthIn = Math.round(size.widthIn * 100) / 100;
    const heightIn = Math.round(size.heightIn * 100) / 100;
    if (dpiRating(effectiveDpi(art, widthIn), method) === "low" && !o.lowResOk) {
      throw new OrderError(`The artwork on ${area.label.split("/").pop()!.trim()} is low resolution for that size. Make it smaller, or tick that you're OK with it.`);
    }
    const perColor = method.pricingModel === "PER_COLOR";
    const perStitch = method.pricingModel === "PER_STITCH";
    const coverage = perStitch ? await fileCoverage(db, art.artworkFileId) : (art.coverage ?? null);
    const colors = perColor ? Math.min(Math.max(1, d.colors ?? 1), method.maxColors ?? 12) : null;
    out.push({
      ...d,
      areaId: area.id,
      location: area.label,
      widthIn,
      heightIn,
      colors,
      stitches: perStitch ? estimateStitches(widthIn, heightIn, coverage, method.stitchDensity ?? DEFAULT_STITCH_DENSITY) : null,
      stitchesSet: false,
      needsArtwork: false,
      needsDigitizing: perStitch,
      reuseScreens: false,
      artwork: { ...art, coverage },
      notes: [d.notes, dpiRating(effectiveDpi(art, widthIn), method) === "low" ? "Shopper accepted low resolution" : null].filter(Boolean).join(" · ") || null,
    });
  }
  return out;
}
