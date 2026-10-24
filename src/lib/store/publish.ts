import "server-only";
import type { BusinessDb } from "@/lib/db";
import { logEvent, OrderError } from "@/lib/orders/service";
import { basePricesFor, createStoreItem, type ItemDecoration, refreshMockupPicture } from "./items";

/**
 * "update": add the order's items, updating the ones published from it before.
 * "overwrite": take every item out of the store first, then add the order's.
 */
export type PublishMode = "update" | "overwrite";

export type PublishResult = { added: number; updated: number; removed: number };

/**
 * Publish a quote's or order's items to a store. Each item shares the
 * line's design (editing the order later makes the line its own copy) and
 * sells every size its color comes in, priced as a batch of the quantity
 * ordered (or `batchQty` for every item).
 */
export async function publishToStore(
  db: BusinessDb,
  orderId: string,
  o: { storeId: string; mode: PublishMode; lineIds?: string[]; batchQty?: number | null; staffId: string | null },
): Promise<PublishResult> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { sizes: true, design: { include: { product: true, color: true, decorations: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
  const store = await db.store.findUniqueOrThrow({ where: { id: o.storeId } });
  const lines = order.lines.filter((l) => !o.lineIds || o.lineIds.includes(l.id));
  if (lines.length === 0) throw new OrderError("Choose at least one item to publish");
  if (o.batchQty != null && o.batchQty < 1) throw new OrderError("Batch quantity must be at least 1");

  // Price everything first, so a pricing problem stops the publish before the store changes.
  const plans = [];
  for (const line of lines) {
    const variants = await db.productVariant.findMany({ where: { productId: line.design.productId, colorId: line.design.colorId, active: true }, select: { sizeId: true } });
    const sizeIds = variants.map((v) => v.sizeId);
    if (sizeIds.length === 0) throw new OrderError(`${line.design.product.name} in ${line.design.color.name} has no sizes to sell`);
    const ordered = line.sizes.reduce((n, s) => n + s.qty, 0);
    const decorations: ItemDecoration[] = line.design.decorations.map((d) => ({
      methodId: d.methodId,
      location: d.location,
      colors: d.colors,
      stitches: d.stitches,
      widthIn: d.widthIn?.toNumber() ?? null,
      heightIn: d.heightIn?.toNumber() ?? null,
    }));
    const batchQty = o.batchQty ?? Math.max(1, ordered);
    const prices = await basePricesFor(db, { productId: line.design.productId, colorId: line.design.colorId, sizeIds, decorations, batchQty });
    plans.push({ line, sizeIds, decorations, batchQty, prices });
  }

  const result: PublishResult = { added: 0, updated: 0, removed: 0 };
  if (o.mode === "overwrite") {
    const items = await db.storeItem.findMany({ where: { storeId: store.id }, select: { id: true } });
    const ids = items.map((i) => i.id);
    // Orders keep their lines; they just lose the link to the item.
    await db.$transaction([db.orderLine.updateMany({ where: { storeItemId: { in: ids } }, data: { storeItemId: null } }), db.storeItem.deleteMany({ where: { id: { in: ids } } })]);
    result.removed = ids.length;
  }

  for (const { line, sizeIds, decorations, batchQty, prices } of plans) {
    const existing = o.mode === "update" ? await db.storeItem.findFirst({ where: { storeId: store.id, sourceLineId: line.id }, include: { prices: true } }) : null;
    if (existing) {
      // Same item: new design and base prices; its name, picture and price overrides stay.
      await db.$transaction([
        db.storeItem.update({ where: { id: existing.id }, data: { designId: line.designId } }),
        db.storeItemPrice.deleteMany({ where: { itemId: existing.id, sizeId: { notIn: sizeIds } } }),
        ...[...prices].map(([sizeId, basePrice]) =>
          db.storeItemPrice.upsert({
            where: { itemId_sizeId: { itemId: existing.id, sizeId } },
            create: { businessId: db.$businessId, itemId: existing.id, sizeId, basePrice },
            update: { basePrice },
          }),
        ),
      ]);
      await refreshMockupPicture(db, existing.id);
      result.updated++;
    } else {
      await createStoreItem(db, store.id, {
        name: line.design.product.name,
        description: null,
        productId: line.design.productId,
        colorId: line.design.colorId,
        sizeIds,
        decorations,
        batchQty,
        designId: line.designId,
        sourceLineId: line.id,
      });
      result.added++;
    }
  }

  const parts = [result.added && `${result.added} added`, result.updated && `${result.updated} updated`, result.removed && `${result.removed} removed first`].filter(Boolean);
  await logEvent(db, db.$businessId, order.id, "STORE", `Published to ${store.name} (${parts.join(", ")})`, o.staffId);
  return result;
}
