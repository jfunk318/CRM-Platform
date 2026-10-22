import Link from "next/link";
import type { Business, Store, StorePage } from "@prisma/client";
import { PLATFORM_NAME } from "@/lib/platform";

type NavPage = Pick<StorePage, "id" | "slug" | "title"> & { children: Pick<StorePage, "id" | "slug" | "title">[] };

/** Header: logo or name, navigation with dropdowns, search, account and cart. */
export function StoreHeader({ store, pages, cartCount, signedIn, accounts, hasItems }: { store: Store; pages: NavPage[]; cartCount: number; signedIn: boolean; accounts: boolean; hasItems: boolean }) {
  const href = (slug: string) => (slug === "home" ? "/" : `/${slug}`);
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          {store.logoFileId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/media/${store.logoFileId}`} alt={store.name} className="h-10 w-auto" />
          ) : (
            store.name
          )}
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium" aria-label="Main">
          {hasItems && <Link href="/shop" className="hover:text-[var(--accent)]">Shop</Link>}
          <Link href="/catalog" className="hover:text-[var(--accent)]">Catalog</Link>
          {pages.map((p) =>
            p.children.length ? (
              <div key={p.id} className="group relative">
                <Link href={href(p.slug)} className="hover:text-[var(--accent)]">{p.title} ▾</Link>
                <div className="invisible absolute left-0 z-20 min-w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg group-focus-within:visible group-hover:visible">
                  {p.children.map((c) => (
                    <Link key={c.id} href={href(c.slug)} className="block px-3 py-1.5 hover:bg-gray-50">{c.title}</Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={p.id} href={href(p.slug)} className="hover:text-[var(--accent)]">{p.title}</Link>
            ),
          )}
          <Link href="/quote" className="hover:text-[var(--accent)]">Request a quote</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <form action="/search" className="hidden sm:block">
            <input name="q" type="search" placeholder="Search" aria-label="Search" className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm" />
          </form>
          {accounts && <Link href="/account" className="hover:text-[var(--accent)]">{signedIn ? "My account" : "Sign in"}</Link>}
          <Link href="/cart" className="rounded-full bg-[var(--accent)] px-3 py-1 font-semibold text-white" data-testid="cart-link">
            Cart{cartCount ? ` (${cartCount})` : ""}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function StoreFooter({ business, store, pages }: { business: Business; store: Store; pages: Pick<StorePage, "id" | "slug" | "title">[] }) {
  const address = [business.addressLine1, [business.city, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  return (
    <footer className="mt-12 border-t border-gray-200 bg-gray-50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-gray-600 sm:grid-cols-3">
        <div>
          <div className="font-semibold text-gray-900">{store.name}</div>
          {store.footerText && <p className="mt-1 whitespace-pre-wrap">{store.footerText}</p>}
        </div>
        <div className="space-y-1">
          {address && <div>{address}</div>}
          {business.phone && <div>{business.phone}</div>}
          {business.email && <a href={`mailto:${business.email}`} className="hover:underline">{business.email}</a>}
        </div>
        <nav className="flex flex-col gap-1" aria-label="Footer">
          <Link href="/track" className="hover:underline">Track your order</Link>
          {pages.map((p) => <Link key={p.id} href={`/${p.slug}`} className="hover:underline">{p.title}</Link>)}
        </nav>
      </div>
      <div className="pb-6 text-center text-xs text-gray-400">Powered by {PLATFORM_NAME}</div>
    </footer>
  );
}
