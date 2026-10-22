import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { blankFromPrices } from "@/lib/store/catalog";
import { money } from "@/components/store/items";

export const metadata = { title: "Catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const rs = await getRequestStore();
  if (!rs) notFound();
  const { category } = await searchParams;
  const [categories, selected] = await Promise.all([
    rs.db.category.findMany({ where: { products: { some: { product: { status: "ACTIVE" } } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    category ? rs.db.category.findFirst({ where: { slug: category } }) : null,
  ]);
  const products = await rs.db.product.findMany({
    where: { status: "ACTIVE", variants: { some: { active: true } }, ...(selected ? { categories: { some: { categoryId: selected.id } } } : {}) },
    orderBy: { name: "asc" },
    include: { colors: { orderBy: { sortOrder: "asc" } }, views: { orderBy: { sortOrder: "asc" }, take: 1, include: { images: { take: 1 } } } },
    take: 200,
  });
  const from = rs.settings.showPrices ? await blankFromPrices(rs.db, products.map((p) => p.id)) : new Map();
  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <nav className="space-y-1 text-sm" aria-label="Categories">
        <div className="mb-2 font-semibold">Categories</div>
        <Link href="/catalog" className={`block ${!selected ? "font-semibold text-[var(--accent)]" : "hover:underline"}`}>Everything</Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/catalog?category=${c.slug}`} className={`block ${selected?.id === c.id ? "font-semibold text-[var(--accent)]" : "hover:underline"}`}>{c.name}</Link>
        ))}
      </nav>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold">{selected?.name ?? "Catalog"}</h1>
          <p className="text-gray-600">{selected?.description ?? "Garments we decorate. Pick one to see colors and sizes, then request a quote."}</p>
        </div>
        {products.length === 0 && <p className="text-gray-500">Nothing here yet.</p>}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-3" data-testid="catalog-grid">
          {products.map((p) => {
            const img = p.views[0]?.images[0]?.url;
            return (
              <Link key={p.id} href={`/catalog/${p.slug}`} className="group block">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                  {img && /^https:\/\//.test(img) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-gray-300">{p.styleCode}</span>
                  )}
                </div>
                <div className="mt-2 font-medium group-hover:text-[var(--accent)]">{p.name}</div>
                <div className="text-xs text-gray-500">{p.brand ? `${p.brand} · ` : ""}{p.styleCode} · {p.colors.length} color{p.colors.length === 1 ? "" : "s"}</div>
                {from.get(p.id) && <div className="text-sm">Blanks from {money(from.get(p.id)!)}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.colors.slice(0, 12).map((c) => <span key={c.id} title={c.name} className="h-3.5 w-3.5 rounded-full border border-gray-300" style={{ background: c.hex ?? "#fff" }} />)}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
