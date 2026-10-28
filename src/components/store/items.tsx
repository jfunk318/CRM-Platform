import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import type { Prisma, Store, StoreGroup } from "@prisma/client";
import { itemPrice } from "@/lib/store/settings";

export const shopItemsInclude = {
  prices: true,
  design: { include: { product: { include: { views: { orderBy: { sortOrder: "asc" }, take: 1, include: { images: true } } } }, color: true } },
} satisfies Prisma.StoreItemInclude;

type ShopItem = Prisma.StoreItemGetPayload<{ include: typeof shopItemsInclude }>;

export const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;

/** The item's own picture, else the product photo in its color. */
export function itemImage(item: ShopItem): string | null {
  if (item.imageFileId) return `/media/${item.imageFileId}`;
  const img = item.design.product.views[0]?.images.find((i) => i.colorId === item.design.colorId);
  return img && /^https:\/\//.test(img.url) ? img.url : null;
}

/** Lowest and highest price across sizes. */
export function priceRange(item: ShopItem, store: Store & { group?: StoreGroup | null }) {
  const prices = item.prices.map((p) => itemPrice(p, item, store));
  if (!prices.length) return null;
  const lo = prices.reduce((a, b) => (b.lt(a) ? b : a));
  const hi = prices.reduce((a, b) => (b.gt(a) ? b : a));
  return lo.equals(hi) ? money(lo) : `${money(lo)} – ${money(hi)}`;
}

const COLS = ["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4", "md:grid-cols-5", "md:grid-cols-6"];

export function ItemGrid({ items, store, showPrices, columns = 4 }: { items: ShopItem[]; store: Store & { group?: StoreGroup | null }; showPrices: boolean; columns?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-x-5 gap-y-8 ${COLS[columns] ?? COLS[4]}`} data-testid="item-grid">
      {items.map((item) => {
        const img = itemImage(item);
        return (
          <Link key={item.id} href={`/shop/${item.slug}`} className="st-item group block" data-testid="item-card">
            <div className="st-item-image flex aspect-square items-center justify-center overflow-hidden">
              {img ? (
                <ProductImage src={img} alt={item.name} width={500} height={500} sizes="(min-width: 768px) 25vw, 50vw" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              ) : (
                <span className="h-16 w-16 rounded-full border" style={{ background: item.design.color.hex ?? "#e5e7eb" }} />
              )}
            </div>
            <div className="st-item-body mt-3 space-y-0.5">
              <div className="st-item-name group-hover:text-[var(--accent)]">{item.name}</div>
              <div className="text-sm text-[var(--st-muted)]">{item.design.color.name}</div>
              {showPrices && <div className="st-item-price text-sm font-semibold">{priceRange(item, store)}</div>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
