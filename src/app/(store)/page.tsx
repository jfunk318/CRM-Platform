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
import { HomeSections } from "@/components/store/home-sections";
import { parseSite, sectionsOf, SOCIALS, type SocialKey } from "@/lib/store/homepage";
import { requestOrigin } from "@/lib/business";

export async function generateMetadata(): Promise<Metadata> {
  const rs = await getRequestStore();
  if (!rs) return { title: PLATFORM_NAME };
  const home = await rs.db.storePage.findFirst({ where: { storeId: rs.store.id, slug: "home", published: true } });
  const title = home?.seoTitle ?? rs.store.name + (rs.store.tagline ? ` · ${rs.store.tagline}` : "");
  const description = home?.seoDescription ?? rs.store.tagline ?? undefined;
  // How the site looks when shared on social media and in messages.
  const heroPhoto = rs.store.kind === "ROOT" ? sectionsOf(rs.store, rs.business).find((x) => x.kind === "hero" && x.on)?.data.image : null;
  const picture = (typeof heroPhoto === "string" ? heroPhoto : null) ?? rs.store.heroImageFileId ?? rs.store.logoFileId;
  const origin = await requestOrigin();
  const images = picture ? [`${origin}/media/${picture}`] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, siteName: rs.store.name, type: "website", url: origin, images },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images },
  };
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
  if (rs.store.kind === "ROOT") return <MainHome rs={rs} />;
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

/** The business's own website: its homepage sections, plus details search engines read. */
async function MainHome({ rs }: { rs: NonNullable<Awaited<ReturnType<typeof getRequestStore>>> }) {
  const { db, store, business, settings } = rs;
  const site = parseSite(store.siteSettings);
  const origin = await requestOrigin();
  const sameAs = (Object.keys(SOCIALS) as SocialKey[]).map((k) => site.social[k]).filter(Boolean);
  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    url: origin,
    ...(store.tagline ? { description: store.tagline } : {}),
    ...(store.logoFileId ? { logo: `${origin}/media/${store.logoFileId}`, image: `${origin}/media/${store.heroImageFileId ?? store.logoFileId}` } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(business.email ? { email: business.email } : {}),
    ...(business.addressLine1
      ? { address: { "@type": "PostalAddress", streetAddress: [business.addressLine1, business.addressLine2].filter(Boolean).join(", "), addressLocality: business.city, addressRegion: business.region, postalCode: business.postalCode, addressCountry: business.country } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <HomeSections sections={sectionsOf(store, business)} db={db} store={store} business={business} site={site} showPrices={settings.showPrices} />
    </>
  );
}
