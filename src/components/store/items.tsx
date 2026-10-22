import Link from "next/link";
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

export function ItemGrid({ items, store, showPrices }: { items: ShopItem[]; store: Store & { group?: StoreGroup | null }; showPrices: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4" data-testid="item-grid">
      {items.map((item) => {
        const img = itemImage(item);
        return (
          <Link key={item.id} href={`/shop/${item.slug}`} className="group block">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <span className="h-16 w-16 rounded-full border" style={{ background: item.design.color.hex ?? "#e5e7eb" }} />
              )}
            </div>
            <div className="mt-2 font-medium group-hover:text-[var(--accent)]">{item.name}</div>
            <div className="text-sm text-gray-600">{item.design.color.name}</div>
            {showPrices && <div className="text-sm font-semibold">{priceRange(item, store)}</div>}
          </Link>
        );
      })}
    </div>
  );
}
