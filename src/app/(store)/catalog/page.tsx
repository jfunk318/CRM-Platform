import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { productSearch } from "@/lib/catalog/search";
import { getRequestStore } from "@/lib/store/resolve";
import { blankFromPrices } from "@/lib/store/catalog";
import { money } from "@/components/store/items";
import { ProductImage } from "@/components/product-image";

export const metadata = { title: "Catalog" };

const PAGE_SIZE = 48;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; page?: string }> }) {
  const rs = await getRequestStore();
  if (!rs || rs.store.kind !== "ROOT") notFound();
  const sp = await searchParams;
  const { category } = sp;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [categories, selected] = await Promise.all([
    rs.db.category.findMany({ where: { products: { some: { product: { status: "ACTIVE" } } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    category ? rs.db.category.findFirst({ where: { slug: category } }) : null,
  ]);
  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    variants: { some: { active: true } },
    ...(selected ? { categories: { some: { categoryId: selected.id } } } : {}),
    ...productSearch(q ?? ""),
  };
  const [products, total] = await Promise.all([
    rs.db.product.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        colors: { orderBy: { sortOrder: "asc" }, take: 12 },
        _count: { select: { colors: true } },
        views: { orderBy: { sortOrder: "asc" }, take: 1, include: { images: { take: 1 } } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    rs.db.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: { page?: number; category?: string | null }) => {
    const qs = new URLSearchParams();
    const cat = p.category === undefined ? selected?.slug : p.category;
    if (cat) qs.set("category", cat);
    if (q) qs.set("q", q);
    if (p.page && p.page > 1) qs.set("page", String(p.page));
    return `/catalog${qs.size ? `?${qs}` : ""}`;
  };
  const from = rs.settings.showPrices ? await blankFromPrices(rs.db, products.map((p) => p.id)) : new Map();
  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <nav className="space-y-1 text-sm" aria-label="Categories">
        <div className="mb-2 font-semibold">Categories</div>
        <Link href={href({ category: null })} className={`block ${!selected ? "font-semibold text-[var(--accent)]" : "hover:underline"}`}>Everything</Link>
        {categories.map((c) => (
          <Link key={c.id} href={href({ category: c.slug })} className={`block ${selected?.id === c.id ? "font-semibold text-[var(--accent)]" : "hover:underline"}`}>{c.name}</Link>
        ))}
      </nav>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{selected?.name ?? "Catalog"}</h1>
            <p className="text-[var(--st-muted)]">{selected?.description ?? "Garments we decorate. Pick one to see colors and sizes, then request a quote."}</p>
          </div>
          <form action="/catalog" className="flex gap-2" role="search">
            {selected && <input type="hidden" name="category" value={selected.slug} />}
            <input className="w-56 rounded border border-[var(--st-border)] px-3 py-1.5 text-sm" name="q" defaultValue={q ?? ""} placeholder="Style, brand or name" aria-label="Search the catalog" />
            <button className="rounded border border-[var(--st-border)] px-3 py-1.5 text-sm">Search</button>
          </form>
        </div>
        {total > 0 && (
          <p className="text-sm text-[var(--st-muted)]" data-testid="catalog-count">
            {total.toLocaleString()} style{total === 1 ? "" : "s"}{q ? ` matching “${q}”` : ""}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>
        )}
        {products.length === 0 && <p className="text-[var(--st-muted)]">{q ? "Nothing matches that search." : "Nothing here yet."}</p>}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-3" data-testid="catalog-grid">
          {products.map((p) => {
            const img = p.views[0]?.images[0]?.url;
            return (
              <Link key={p.id} href={`/catalog/${p.slug}`} className="group block">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[var(--st-subtle)]">
                  {img && /^https:\/\//.test(img) ? (
                    <ProductImage src={img} alt={p.name} width={600} height={600} sizes="(min-width: 1024px) 300px, 50vw" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-[var(--st-faint)]">{p.styleCode}</span>
                  )}
                </div>
                <div className="mt-2 font-medium group-hover:text-[var(--accent)]">{p.name}</div>
                <div className="text-xs text-[var(--st-muted)]">{p.brand ? `${p.brand} · ` : ""}{p.styleCode} · {p._count.colors} color{p._count.colors === 1 ? "" : "s"}</div>
                {from.get(p.id) && <div className="text-sm">Blanks from {money(from.get(p.id)!)}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.colors.map((c) => <span key={c.id} title={c.name} className="h-3.5 w-3.5 rounded-full border border-[var(--st-border)]" style={{ background: c.hex ?? "#fff" }} />)}
                </div>
              </Link>
            );
          })}
        </div>
        {pages > 1 && (
          <nav className="flex items-center justify-center gap-4 text-sm" aria-label="Pages">
            {page > 1 ? <Link href={href({ page: page - 1 })} className="hover:underline">← Previous</Link> : <span className="text-[var(--st-faint)]">← Previous</span>}
            <span className="text-[var(--st-muted)]">Page {page} of {pages}</span>
            {page < pages ? <Link href={href({ page: page + 1 })} className="hover:underline">Next →</Link> : <span className="text-[var(--st-faint)]">Next →</span>}
          </nav>
        )}
      </div>
    </div>
  );
}
