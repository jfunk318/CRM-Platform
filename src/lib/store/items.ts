import "server-only";
import { Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { slugify } from "@/lib/catalog/products";
import { decorationData, type DecorationSpec, OrderError } from "@/lib/orders/service";
import { priceLineItem } from "@/lib/pricing";
import { type DecorationRequest, LineRequestError, loadLineItemInput } from "@/lib/pricing/load";

export type ItemDecoration = DecorationSpec;

/**
 * Per-size base prices for a decorated product as if ordered in a batch of
 * `batchQty`: garment plus decoration at that quantity's price break, with
 * one-time fees (screens, digitizing…) spread across the batch.
 */
export async function basePricesFor(
  db: BusinessDb,
  o: { productId: string; colorId: string; sizeIds: string[]; decorations: ItemDecoration[]; batchQty: number },
): Promise<Map<string, Prisma.Decimal>> {
  if (o.batchQty < 1) throw new OrderError("Batch quantity must be at least 1");
  const decorations: DecorationRequest[] = o.decorations.map((d) => ({
    methodId: d.methodId,
    location: d.location,
    colors: d.colors ?? undefined,
    stitches: d.stitches ?? undefined,
    widthIn: d.widthIn ?? undefined,
    heightIn: d.heightIn ?? undefined,
    pricingQty: o.batchQty,
  }));
  try {
    const input = await loadLineItemInput(db, {
      productId: o.productId,
      colorId: o.colorId,
      quantities: Object.fromEntries(o.sizeIds.map((id) => [id, 1])),
      decorations,
    });
    const price = priceLineItem(input);
    const error = price.issues.find((i) => i.severity === "error");
    if (error) throw new OrderError(error.message);
    const feesEach = price.feesTotal.dividedBy(o.batchQty);
    const sizes = await db.productSize.findMany({ where: { id: { in: o.sizeIds } } });
    const out = new Map<string, Prisma.Decimal>();
    for (const s of sizes) {
      const row = price.sizes.find((r) => r.sizeCode === s.code);
      if (row) out.set(s.id, new Prisma.Decimal(row.unitPrice.plus(feesEach).toFixed(2)));
    }
    return out;
  } catch (e) {
    if (e instanceof LineRequestError) throw new OrderError(e.message);
    throw e;
  }
}

/** Create a store item: a reusable design plus per-size prices. */
export async function createStoreItem(
  db: BusinessDb,
  storeId: string,
  o: { name: string; description: string | null; productId: string; colorId: string; sizeIds: string[]; decorations: ItemDecoration[]; batchQty: number },
): Promise<string> {
  if (o.sizeIds.length === 0) throw new OrderError("Choose at least one size to sell");
  const prices = await basePricesFor(db, o);
  const businessId = db.$businessId;
  const product = await db.product.findUniqueOrThrow({ where: { id: o.productId } });
  const color = await db.productColor.findUniqueOrThrow({ where: { id: o.colorId } });
  return db.$transaction(async (tx) => {
    const design = await tx.design.create({
      data: {
        businessId,
        name: `${product.name} — ${color.name}`,
        productId: o.productId,
        colorId: o.colorId,
        decorations: { create: o.decorations.map(decorationData) },
      },
    });
    let slug = slugify(o.name) || "item";
    for (let n = 2; await tx.storeItem.findUnique({ where: { storeId_slug: { storeId, slug } } }); n++) slug = `${slugify(o.name)}-${n}`;
    const item = await tx.storeItem.create({
      data: {
        businessId,
        storeId,
        designId: design.id,
        name: o.name,
        slug,
        description: o.description,
        sortOrder: await tx.storeItem.count({ where: { storeId } }),
        prices: { create: [...prices].map(([sizeId, basePrice]) => ({ sizeId, basePrice })) },
      },
    });
    return item.id;
  });
}

/** Re-work an item's base prices at a new batch quantity; overrides stay. */
export async function repriceStoreItem(db: BusinessDb, itemId: string, batchQty: number) {
  const item = await db.storeItem.findUniqueOrThrow({ where: { id: itemId }, include: { prices: true, design: { include: { decorations: true } } } });
  const prices = await basePricesFor(db, {
    productId: item.design.productId,
    colorId: item.design.colorId,
    sizeIds: item.prices.map((p) => p.sizeId),
    decorations: item.design.decorations.map((d) => ({
      methodId: d.methodId,
      location: d.location,
      colors: d.colors,
      stitches: d.stitches,
      widthIn: d.widthIn?.toNumber() ?? null,
      heightIn: d.heightIn?.toNumber() ?? null,
    })),
    batchQty,
  });
  await db.$transaction(item.prices.map((p) => db.storeItemPrice.update({ where: { id: p.id }, data: { basePrice: prices.get(p.sizeId) ?? p.basePrice } })));
}
