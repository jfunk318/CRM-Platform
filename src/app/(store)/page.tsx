import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestBusiness } from "@/lib/business";
import type { Metadata } from "next";
import { PLATFORM_NAME } from "@/lib/platform";
import { getRequestStore } from "@/lib/store/resolve";
import { PageBody } from "@/components/store/showcase";
import { ItemGrid, shopItemsInclude } from "@/components/store/items";
import { StoreHero } from "@/components/store/hero";
import { THEMES, themeOf } from "@/lib/store/themes";

export async function generateMetadata(): Promise<Metadata> {
  const rs = await getRequestStore();
  if (!rs) return { title: PLATFORM_NAME };
  const home = await rs.db.storePage.findFirst({ where: { storeId: rs.store.id, slug: "home", published: true } });
  return { title: home?.seoTitle ?? rs.store.name + (rs.store.tagline ? ` · ${rs.store.tagline}` : ""), description: home?.seoDescription ?? rs.store.tagline ?? undefined };
}

export default async function Home() {
  const rs = await getRequestStore();
  // A business address with no store here (e.g. an unknown subdomain).
  if (!rs && (await getRequestBusiness())) notFound();
  if (!rs) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold">{PLATFORM_NAME}</h1>
        <p className="mt-4 text-[var(--st-muted)]">Print-shop business platform.</p>
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
  const theme = THEMES[themeOf(rs.store.theme)];
  const hasBody = !!home?.body.trim();
  return (
    <div className="space-y-12">
      {rs.store.showHero && <StoreHero store={rs.store} style={theme.hero} eyebrow={rs.store.kind === "AFFILIATE" && rs.store.closesAt ? rs.status.label : null} />}
      {hasBody ? <PageBody body={home!.body} db={rs.db} currentStoreId={rs.store.id} /> : !rs.store.showHero && <h1 className="text-4xl">{rs.store.name}</h1>}
      {featured.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-baseline justify-between border-b border-[var(--st-border)] pb-3">
            <h2 className="text-2xl sm:text-3xl">{featured.some((f) => f.featured) ? "Featured" : "Shop"}</h2>
            <Link href="/shop" className="text-sm font-medium text-[var(--accent)] hover:underline">See everything →</Link>
          </div>
          <ItemGrid items={featured} store={rs.store} showPrices={rs.settings.showPrices} />
        </section>
      )}
    </div>
  );
}
