import "server-only";
import { Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { slugify } from "@/lib/catalog/products";
import { designMockups, renderMockup } from "@/lib/design/mockups";
import { fileStore, saveUpload } from "@/lib/files/storage";
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

/**
 * Create a store item: a design plus per-size prices. A new design is made
 * from `decorations`, or an existing one (a quote/order line's) is shared.
 * If the design has artwork placed, its mockup becomes the item's picture.
 */
export async function createStoreItem(
  db: BusinessDb,
  storeId: string,
  o: {
    name: string;
    description: string | null;
    productId: string;
    colorId: string;
    sizeIds: string[];
    decorations: ItemDecoration[];
    batchQty: number;
    designId?: string;
    sourceLineId?: string;
  },
): Promise<string> {
  if (o.sizeIds.length === 0) throw new OrderError("Choose at least one size to sell");
  const prices = await basePricesFor(db, o);
  const businessId = db.$businessId;
  const product = await db.product.findUniqueOrThrow({ where: { id: o.productId } });
  const color = await db.productColor.findUniqueOrThrow({ where: { id: o.colorId } });
  const id = await db.$transaction(async (tx) => {
    const designId =
      o.designId ??
      (
        await tx.design.create({
          data: {
            businessId,
            name: `${product.name} — ${color.name}`,
            productId: o.productId,
            colorId: o.colorId,
            decorations: { create: o.decorations.map(decorationData) },
          },
        })
      ).id;
    let slug = slugify(o.name) || "item";
    for (let n = 2; await tx.storeItem.findUnique({ where: { storeId_slug: { storeId, slug } } }); n++) slug = `${slugify(o.name) || "item"}-${n}`;
    const item = await tx.storeItem.create({
      data: {
        businessId,
        storeId,
        designId,
        name: o.name,
        slug,
        description: o.description,
        sourceLineId: o.sourceLineId ?? null,
        sortOrder: await tx.storeItem.count({ where: { storeId } }),
        prices: { create: [...prices].map(([sizeId, basePrice]) => ({ sizeId, basePrice })) },
      },
    });
    return item.id;
  });
  await refreshMockupPicture(db, id);
  return id;
}

/** A picture of the design's first mockup, saved as a file; null if no artwork is placed. */
async function mockupPicture(db: BusinessDb, designId: string, name: string): Promise<string | null> {
  const [m] = (await designMockups(db, [designId])).get(designId) ?? [];
  if (!m) return null;
  const png = await renderMockup(db, m);
  const fileName = `${name} ${m.viewName} mockup.png`.replace(/[^\w .-]+/g, " ").replace(/\s+/g, " ");
  return (await saveUpload(db, new File([new Uint8Array(png)], fileName, { type: "image/png" }), null)).id;
}

/**
 * Make the item's picture from its design's mockup, unless staff uploaded
 * their own picture (`force` replaces that too). The previous mockup picture
 * is deleted.
 */
export async function refreshMockupPicture(db: BusinessDb, itemId: string, force = false): Promise<boolean> {
  const item = await db.storeItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.imageFileId && !item.imageIsMockup && !force) return false;
  const fileId = await mockupPicture(db, item.designId, item.name);
  if (!fileId) return false;
  await db.storeItem.update({ where: { id: item.id }, data: { imageFileId: fileId, imageIsMockup: true } });
  if (item.imageFileId && item.imageIsMockup) await removeIfUnused(db, item.imageFileId);
  return true;
}

/** Delete a generated picture once no item, order or proof uses it. */
async function removeIfUnused(db: BusinessDb, fileId: string) {
  const file = await db.storedFile.findUnique({
    where: { id: fileId },
    include: { _count: { select: { storeItems: true, orderFiles: true, proofFiles: true, storeLogos: true, artworkFor: true, artSourceFor: true, artworkAssets: true } } },
  });
  if (!file || Object.values(file._count).some((n) => n > 0)) return;
  await db.storedFile.delete({ where: { id: file.id } });
  await fileStore.remove(file.storageKey);
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
