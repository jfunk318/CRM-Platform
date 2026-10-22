import Link from "next/link";
import type { Metadata } from "next";
import { PLATFORM_NAME } from "@/lib/platform";
import { getRequestStore } from "@/lib/store/resolve";
import { Markdown } from "@/components/store/markdown";
import { ItemGrid, shopItemsInclude } from "@/components/store/items";

export async function generateMetadata(): Promise<Metadata> {
  const rs = await getRequestStore();
  if (!rs) return { title: PLATFORM_NAME };
  const home = await rs.db.storePage.findFirst({ where: { storeId: rs.store.id, slug: "home", published: true } });
  return { title: home?.seoTitle ?? rs.store.name + (rs.store.tagline ? ` · ${rs.store.tagline}` : ""), description: home?.seoDescription ?? rs.store.tagline ?? undefined };
}

export default async function Home() {
  const rs = await getRequestStore();
  if (!rs) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold">{PLATFORM_NAME}</h1>
        <p className="mt-4 text-gray-600">Print-shop business platform.</p>
        <Link href="/platform" className="mt-6 inline-block text-amber-700 underline">Platform sign in</Link>
      </main>
    );
  }
  const [home, featured] = await Promise.all([
    rs.db.storePage.findFirst({ where: { storeId: rs.store.id, slug: "home", published: true } }),
    rs.db.storeItem.findMany({
      where: { storeId: rs.store.id, published: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
      take: 8,
      include: shopItemsInclude,
    }),
  ]);
  return (
    <div className="space-y-10">
      {home ? <Markdown source={home.body} /> : <h1 className="text-3xl font-bold">{rs.store.name}</h1>}
      {featured.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold">Shop</h2>
            <Link href="/shop" className="text-sm text-[var(--accent)] hover:underline">See everything →</Link>
          </div>
          <ItemGrid items={featured} store={rs.store} showPrices={rs.settings.showPrices} />
        </section>
      )}
    </div>
  );
}
