import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { designerConfig, designerGarments } from "@/lib/store/designer";
import { getRequestStore } from "@/lib/store/resolve";

export async function generateMetadata() {
  const rs = await getRequestStore();
  return { title: rs ? `Design your own · ${rs.store.name}` : "Design your own" };
}

/** Pick a garment to design on. */
export default async function DesignPage() {
  const rs = await getRequestStore();
  if (!rs) notFound();
  const config = await designerConfig(rs.db, rs.store);
  if (!config.enabled) notFound();
  const garments = await designerGarments(rs.db, rs.store, config);
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl">Design your own</h1>
        <p className="max-w-2xl text-[var(--st-muted)]">
          Choose a garment, then add {[config.upload && "your own artwork", config.text && "text", config.library && "our logos"].filter(Boolean).join(", ")}. You&apos;ll see the price as you go.
        </p>
      </div>
      {garments.length === 0 ? (
        <p className="text-[var(--st-muted)]">Nothing to design on yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4" data-testid="designer-garments">
          {garments.map((g) => (
            <Link key={g.id} href={`/design/${g.slug}`} className="st-item group block" data-testid="designer-garment">
              <div className="st-item-image flex aspect-square items-center justify-center overflow-hidden">
                {g.image ? (
                  <ProductImage src={g.image} alt={g.name} width={500} height={500} sizes="(min-width: 768px) 25vw, 50vw" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <span className="text-2xl font-bold text-[var(--st-faint)]">{g.styleCode}</span>
                )}
              </div>
              <div className="st-item-body mt-3 space-y-1">
                <div className="st-item-name group-hover:text-[var(--accent)]">{g.name}</div>
                <div className="flex flex-wrap gap-1">
                  {g.colors.slice(0, 12).map((c) => <span key={c.name} title={c.name} className="h-3 w-3 rounded-full border border-[var(--st-border)]" style={{ background: c.hex ?? "#e5e7eb" }} />)}
                  {g.colors.length > 12 && <span className="text-xs text-[var(--st-muted)]">+{g.colors.length - 12}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
