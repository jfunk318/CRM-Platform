import { getRequestStore } from "@/lib/store/resolve";
import { getShopper } from "@/lib/store/accounts";
import { hasStoreAccess } from "@/lib/store/access";
import { currentCart } from "@/lib/store/cart";
import { ActionForm } from "@/components/admin/action-form";
import { Analytics } from "@/components/store/analytics";
import { VisitBeacon } from "@/components/store/visit-beacon";
import { StoreFooter, StoreHeader } from "@/components/store/chrome";
import { enterAccessCode } from "./actions";

const HEX = /^#[0-9a-f]{6}$/i;

/** Every storefront page: the store's branding, navigation and footer. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const rs = await getRequestStore();
  // The platform's own address has no store; its pages render on their own.
  if (!rs) return <>{children}</>;
  const { db, store, business, settings } = rs;
  const [pages, cart, shopper, itemCount, access] = await Promise.all([
    db.storePage.findMany({
      where: { storeId: store.id, published: true, OR: [{ showInNav: true }, { parent: { showInNav: true } }] },
      orderBy: [{ navOrder: "asc" }, { title: "asc" }],
      select: { id: true, slug: true, title: true, parentId: true, showInNav: true },
    }),
    currentCart(rs),
    getShopper(rs),
    db.storeItem.count({ where: { storeId: store.id, published: true } }),
    hasStoreAccess(store),
  ]);
  const top = pages.filter((p) => p.showInNav && !p.parentId).map((p) => ({ ...p, children: pages.filter((c) => c.parentId === p.id) }));
  const accent = store.accentColor && HEX.test(store.accentColor) ? store.accentColor : "#d97706";
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900" style={{ "--accent": accent } as React.CSSProperties}>
      {store.announcement && <div className="bg-[var(--accent)] px-4 py-2 text-center text-sm font-medium text-white">{store.announcement}</div>}
      <StoreHeader
        store={store}
        pages={top}
        cartCount={cart?.items.reduce((n, i) => n + i.qty, 0) ?? 0}
        signedIn={!!shopper}
        accounts={settings.accountMode !== "GUEST_ONLY"}
        hasItems={itemCount > 0}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {rs.status.state !== "open" ? (
          <div className="mx-auto max-w-md space-y-3 py-12 text-center" data-testid="store-closed">
            <h1 className="text-2xl font-bold">{rs.status.state === "scheduled" ? "This store isn't open yet" : "This store is closed"}</h1>
            <p className="text-gray-600">{rs.status.label}. Questions? {business.email ? <a href={`mailto:${business.email}`} className="underline">{business.email}</a> : business.phone}</p>
          </div>
        ) : access ? (
          children
        ) : (
          <div className="mx-auto max-w-sm space-y-4 py-12 text-center">
            <h1 className="text-2xl font-bold">This store is private</h1>
            <p className="text-gray-600">Enter the access code you were given.</p>
            <ActionForm action={enterAccessCode} submitLabel="Enter" className="space-y-3">
              <input className="input text-center" name="code" aria-label="Access code" required autoComplete="off" />
            </ActionForm>
          </div>
        )}
      </main>
      <StoreFooter business={business} store={store} pages={top} />
      <Analytics ga4Id={store.ga4Id} metaPixelId={store.metaPixelId} />
      <VisitBeacon />
    </div>
  );
}
