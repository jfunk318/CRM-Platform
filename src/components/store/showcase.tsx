import { storeUrlHere } from "@/lib/business";
import type { BusinessDb } from "@/lib/db";
import { effectiveSettings, itemPrice, storeStatus } from "@/lib/store/settings";
import { type ItemsOptions, splitBlocks, type ShowcaseOptions } from "@/lib/store/showcase";
import { ItemGrid, shopItemsInclude } from "./items";
import { Markdown } from "./markdown";
import { ShowcaseCards } from "./showcase-cards";

/** A page's content, with its widget lines shown as store showcases and item grids. */
export function PageBody({ body, db, currentStoreId }: { body: string; db: BusinessDb; currentStoreId: string }) {
  return (
    <>
      {splitBlocks(body).map((b, i) =>
        b.kind === "markdown" ? (
          <Markdown key={i} source={b.source} />
        ) : b.kind === "stores" ? (
          <StoreShowcase key={i} db={db} options={b.options} currentStoreId={currentStoreId} />
        ) : (
          <ItemsBlock key={i} db={db} options={b.options} storeId={currentStoreId} />
        ),
      )}
    </>
  );
}

/** Affiliate stores as cards (or a list) linking to their own addresses. */
export async function StoreShowcase({ db, options, currentStoreId }: { db: BusinessDb; options: ShowcaseOptions; currentStoreId: string }) {
  const stores = await db.store.findMany({
    where: {
      kind: "AFFILIATE",
      showcase: true,
      id: { not: currentStoreId },
      ...(options.group ? { group: { name: { equals: options.group, mode: "insensitive" } } } : {}),
    },
    include: {
      group: { select: { name: true } },
      items: { where: { published: true }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }], take: 3, select: { id: true, imageFileId: true, name: true } },
    },
    orderBy: options.sort === "oldest" ? { createdAt: "asc" } : options.sort === "name" ? { name: "asc" } : { createdAt: "desc" },
  });
  const now = new Date();
  let shown = stores.map((s) => ({ ...s, status: storeStatus(s, now) })).filter((s) => options.includeClosed || s.status.state === "open");
  if (options.sort === "sales") {
    const sales = await db.order.groupBy({ by: ["storeId"], where: { type: "ORDER", storeId: { in: shown.map((s) => s.id) } }, _sum: { total: true } });
    const total = (id: string) => sales.find((x) => x.storeId === id)?._sum.total?.toNumber() ?? 0;
    shown = [...shown].sort((a, b) => total(b.id) - total(a.id));
  }
  if (options.sort === "closing") shown = [...shown].sort((a, b) => (a.closesAt?.getTime() ?? Infinity) - (b.closesAt?.getTime() ?? Infinity));
  shown = shown.slice(0, options.limit);
  const urls = await Promise.all(shown.map((s) => storeUrlHere(s.slug)));
  return (
    <ShowcaseCards
      layout={options.layout}
      columns={options.columns}
      filters={options.filters}
      stores={shown.map((s, i) => ({
        id: s.id,
        name: s.name,
        tagline: s.tagline,
        url: urls[i],
        logo: s.logoFileId ? `/media/${s.logoFileId}` : null,
        accent: s.accentColor,
        group: s.group?.name ?? null,
        status: s.status.label,
        pictures: s.items.filter((it) => it.imageFileId).map((it) => ({ id: it.id, src: `/media/${it.imageFileId}`, name: it.name })),
      }))}
    />
  );
}

/** The store's own items as a grid. */
export async function ItemsBlock({ db, options, storeId }: { db: BusinessDb; options: ItemsOptions; storeId: string }) {
  const [store, business] = await Promise.all([db.store.findUniqueOrThrow({ where: { id: storeId }, include: { group: true } }), db.business.findUniqueOrThrow({ where: { id: db.$businessId } })]);
  const items = await db.storeItem.findMany({
    where: { storeId, published: true, ...(options.featuredOnly ? { featured: true } : {}) },
    include: shopItemsInclude,
    orderBy: options.sort === "newest" ? { createdAt: "desc" } : options.sort === "name" ? { name: "asc" } : [{ featured: "desc" }, { sortOrder: "asc" }],
  });
  const lowest = (it: (typeof items)[number]) => Math.min(...it.prices.map((p) => itemPrice(p, it, store).toNumber()));
  const sorted = options.sort === "price" ? [...items].sort((a, b) => lowest(a) - lowest(b)) : items;
  if (sorted.length === 0) return <p className="my-4 text-gray-500">No items to show yet.</p>;
  return (
    <div className="my-6">
      <ItemGrid items={sorted.slice(0, options.limit)} store={store} showPrices={effectiveSettings(business, store, store.group).showPrices} columns={options.columns} />
    </div>
  );
}
