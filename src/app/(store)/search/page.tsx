import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { ItemGrid, shopItemsInclude } from "@/components/store/items";

export const metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const rs = await getRequestStore();
  if (!rs) notFound();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const match = { contains: q, mode: "insensitive" as const };
  const [items, products, pages] = q
    ? await Promise.all([
        rs.db.storeItem.findMany({ where: { storeId: rs.store.id, published: true, OR: [{ name: match }, { description: match }] }, include: shopItemsInclude, take: 24 }),
        rs.db.product.findMany({ where: { status: "ACTIVE", variants: { some: { active: true } }, OR: [{ name: match }, { styleCode: match }, { brand: match }] }, take: 24, orderBy: { name: "asc" } }),
        rs.db.storePage.findMany({ where: { storeId: rs.store.id, published: true, OR: [{ title: match }, { body: match }] }, take: 10 }),
      ])
    : [[], [], []];
  return (
    <div className="space-y-8">
      <form action="/search" className="flex max-w-lg gap-2">
        <input className="input" name="q" type="search" defaultValue={q} placeholder="Search products and pages" aria-label="Search" />
        <button className="st-btn">Search</button>
      </form>
      {q && items.length + products.length + pages.length === 0 && <p className="text-[var(--st-muted)]">Nothing matches “{q}”.</p>}
      {items.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">In the shop</h2>
          <ItemGrid items={items} store={rs.store} showPrices={rs.settings.showPrices} />
        </section>
      )}
      {products.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Catalog</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id}><Link href={`/catalog/${p.slug}`} className="hover:underline">{p.name} <span className="text-sm text-[var(--st-muted)]">{p.styleCode}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
      {pages.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Pages</h2>
          <ul>{pages.map((p) => <li key={p.id}><Link href={p.slug === "home" ? "/" : `/${p.slug}`} className="hover:underline">{p.title}</Link></li>)}</ul>
        </section>
      )}
    </div>
  );
}
