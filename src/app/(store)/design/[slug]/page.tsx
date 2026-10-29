import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopperDesigner } from "@/components/store/shopper-designer";
import { designerConfig, designerLibrary, designerProduct } from "@/lib/store/designer";
import { getRequestStore } from "@/lib/store/resolve";

async function load(slug: string) {
  const rs = await getRequestStore();
  if (!rs) return null;
  const config = await designerConfig(rs.db, rs.store);
  if (!config.enabled) return null;
  const product = await designerProduct(rs.db, rs.store, config, { slug });
  return product ? { rs, config, product } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  return found ? { title: `Design your ${found.product.name} · ${found.rs.store.name}` } : {};
}

/** The online designer for one garment. */
export default async function DesignProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { rs, config, product } = found;
  const library = await designerLibrary(rs.db, rs.store, config);
  const open = rs.status.state === "open";
  return (
    <div className="space-y-4">
      <Link href="/design" className="text-sm text-[var(--accent)] hover:underline">← Choose another garment</Link>
      {!open && <p className="rounded-md bg-[var(--st-subtle)] px-3 py-2 text-sm">This store isn&apos;t taking orders right now; you can still try designs.</p>}
      <ShopperDesigner
        product={product}
        can={{ upload: config.upload, text: config.text }}
        library={library.map((a) => ({ fileId: a.fileId, name: a.name, url: `/media/${a.fileId}` }))}
        showPrices={rs.settings.showPrices}
        canBuy={open}
      />
    </div>
  );
}
