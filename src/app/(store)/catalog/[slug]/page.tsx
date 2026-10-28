import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { getRequestStore } from "@/lib/store/resolve";
import { blankFromPrices } from "@/lib/store/catalog";
import { money } from "@/components/store/items";
import { QuoteForm } from "@/components/store/quote-form";

async function load(slug: string) {
  const rs = await getRequestStore();
  if (!rs || rs.store.kind !== "ROOT") return null;
  const product = await rs.db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      colors: { orderBy: { sortOrder: "asc" }, where: { variants: { some: { active: true } } } },
      sizes: { orderBy: { sortOrder: "asc" }, where: { variants: { some: { active: true } } } },
      views: { orderBy: { sortOrder: "asc" }, include: { images: true } },
    },
  });
  return product ? { rs, product } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  return found ? { title: `${found.product.name} · ${found.rs.store.name}`, description: found.product.description?.slice(0, 160) } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { rs, product } = found;
  const from = rs.settings.showPrices ? (await blankFromPrices(rs.db, [product.id])).get(product.id) : undefined;
  const images = product.views.flatMap((v) => v.images.filter((i) => /^https:\/\//.test(i.url)).slice(0, 1));
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-3">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[var(--st-subtle)]">
          {images[0] ? (
            <ProductImage src={images[0].url} alt={product.name} width={900} height={900} sizes="(min-width: 768px) 50vw, 100vw" className="h-full w-full object-cover" />
          ) : (
            <span className="text-5xl font-bold text-[var(--st-faint)]">{product.styleCode}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {product.colors.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--st-border)] px-2 py-0.5 text-xs">
              <span className="h-3 w-3 rounded-full border" style={{ background: c.hex ?? "#fff" }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Link href="/catalog" className="text-sm text-[var(--accent)] hover:underline">← Catalog</Link>
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <div className="text-[var(--st-muted)]">{product.brand ? `${product.brand} · ` : ""}{product.styleCode}</div>
        {from && <div className="text-lg">Blanks from <span className="font-semibold">{money(from)}</span> each, plus decoration</div>}
        {product.description &&
          (product.description.includes("\n") ? (
            <ul className="list-disc space-y-0.5 pl-5 text-[var(--st-muted)]">
              {product.description.split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}>{l.replace(/^[-•*]\s*/, "")}</li>)}
            </ul>
          ) : (
            <p className="text-[var(--st-muted)]">{product.description}</p>
          ))}
        <div className="text-sm text-[var(--st-muted)]">Sizes: {product.sizes.map((s) => s.code).join(", ")}</div>
        {product.specSheetUrl && /^https:\/\//.test(product.specSheetUrl) && (
          <a href={product.specSheetUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)] underline">Spec sheet</a>
        )}
        <section className="rounded-lg border border-[var(--st-border)] p-4">
          <h2 className="mb-3 text-lg font-semibold">Get a quote for this</h2>
          <QuoteForm product={{ id: product.id, colors: product.colors, sizes: product.sizes }} />
        </section>
      </div>
    </div>
  );
}
