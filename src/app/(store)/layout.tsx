import { getRequestStore } from "@/lib/store/resolve";
import { designerConfig } from "@/lib/store/designer";
import { getShopper } from "@/lib/store/accounts";
import { hasStoreAccess } from "@/lib/store/access";
import { currentCart } from "@/lib/store/cart";
import { ActionForm } from "@/components/admin/action-form";
import { Analytics } from "@/components/store/analytics";
import { VisitBeacon } from "@/components/store/visit-beacon";
import { StoreFooter, StoreHeader } from "@/components/store/chrome";
import { SiteFooter, SiteHeader, siteMenu } from "@/components/store/site-chrome";
import { parseSite, sectionAnchors, sectionsOf } from "@/lib/store/homepage";
import { THEMES, themeFontsUrl, themeOf, themeStyle } from "@/lib/store/themes";
import { enterAccessCode } from "./actions";

/** The browser-tab icon: the store's favicon, else its logo. */
export async function generateMetadata() {
  const rs = await getRequestStore();
  const icon = rs?.store.faviconFileId ?? rs?.store.logoFileId;
  return icon ? { icons: { icon: `/media/${icon}` } } : {};
}

/** Every storefront page: the store's branding, navigation and footer. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const rs = await getRequestStore();
  // The platform's own address has no store; its pages render on their own.
  if (!rs) return <>{children}</>;
  const { db, store, business, settings } = rs;
  const main = store.kind === "ROOT";
  const [pages, cart, shopper, itemCount, access, designer, storeCount] = await Promise.all([
    db.storePage.findMany({
      where: { storeId: store.id, published: true, OR: [{ showInNav: true }, { parent: { showInNav: true } }] },
      orderBy: [{ navOrder: "asc" }, { title: "asc" }],
      select: { id: true, slug: true, title: true, parentId: true, showInNav: true },
    }),
    currentCart(rs),
    getShopper(rs),
    db.storeItem.count({ where: { storeId: store.id, published: true } }),
    hasStoreAccess(store),
    designerConfig(db, store),
    main ? db.store.count({ where: { kind: "AFFILIATE", showcase: true, active: true } }) : 0,
  ]);
  const top = pages.filter((p) => p.showInNav && !p.parentId).map((p) => ({ ...p, children: pages.filter((c) => c.parentId === p.id) }));
  const theme = themeOf(store.theme);
  const cartCount = cart?.items.reduce((n, i) => n + i.qty, 0) ?? 0;
  // The main site gets the business website's header and footer; affiliate stores their theme's.
  const site = main ? parseSite(store.siteSettings) : null;
  const menu = site
    ? siteMenu({ pages: top, anchors: new Set(sectionAnchors(sectionsOf(store, business)).values()), hasItems: itemCount > 0, hasStores: storeCount > 0, designer: designer.enabled, site })
    : [];
  return (
    <div className="storefront flex min-h-screen flex-col overflow-x-clip" data-theme={theme} style={themeStyle(theme, store.accentColor) as React.CSSProperties}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={themeFontsUrl(theme)} precedence="default" />
      {store.announcement && <div className="bg-[var(--accent)] px-4 py-2 text-center text-sm font-medium text-[var(--accent-contrast)]">{store.announcement}</div>}
      {site ? (
        <SiteHeader store={store} menu={menu} site={site} cartCount={cartCount} signedIn={!!shopper} accounts={settings.accountMode !== "GUEST_ONLY"} />
      ) : (
        <StoreHeader
          style={THEMES[theme].header}
          store={store}
          pages={top}
          cartCount={cartCount}
          signedIn={!!shopper}
          accounts={settings.accountMode !== "GUEST_ONLY"}
          hasItems={itemCount > 0}
          designer={designer.enabled}
        />
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {rs.status.state !== "open" ? (
          <div className="mx-auto max-w-md space-y-3 py-12 text-center" data-testid="store-closed">
            <h1 className="text-2xl font-bold">{rs.status.state === "scheduled" ? "This store isn't open yet" : "This store is closed"}</h1>
            <p className="text-[var(--st-muted)]">{rs.status.label}. Questions? {business.email ? <a href={`mailto:${business.email}`} className="underline">{business.email}</a> : business.phone}</p>
          </div>
        ) : access ? (
          children
        ) : (
          <div className="mx-auto max-w-sm space-y-4 py-12 text-center">
            <h1 className="text-2xl font-bold">This store is private</h1>
            <p className="text-[var(--st-muted)]">Enter the access code you were given.</p>
            <ActionForm action={enterAccessCode} submitLabel="Enter" className="space-y-3">
              <input className="input text-center" name="code" aria-label="Access code" required autoComplete="off" />
            </ActionForm>
          </div>
        )}
      </main>
      {site ? <SiteFooter business={business} store={store} menu={menu} site={site} /> : <StoreFooter business={business} store={store} pages={top} />}
      <Analytics ga4Id={store.ga4Id} metaPixelId={store.metaPixelId} />
      <VisitBeacon />
    </div>
  );
}
