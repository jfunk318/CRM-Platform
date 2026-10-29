import Link from "next/link";
import type { Business, Store, StorePage } from "@prisma/client";
import { PLATFORM_NAME } from "@/lib/platform";
import type { Theme } from "@/lib/store/themes";

type NavPage = Pick<StorePage, "id" | "slug" | "title"> & { children: Pick<StorePage, "id" | "slug" | "title">[] };

type HeaderProps = { style: Theme["header"]; store: Store; pages: NavPage[]; cartCount: number; signedIn: boolean; accounts: boolean; hasItems: boolean; designer?: boolean };

/**
 * Header: logo or name, navigation with dropdowns, search, account and cart.
 * Themes pick a plain bar, a bold bar in the accent color, or a centered
 * logo with the menu underneath.
 */
export function StoreHeader({ style, store, pages, cartCount, signedIn, accounts, hasItems, designer = false }: HeaderProps) {
  const logo = (
    <Link href="/" className={`flex items-center gap-2 font-bold ${style === "centered" ? "text-3xl" : "text-xl"} st-heading`} data-testid="store-logo">
      {store.logoFileId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/media/${store.logoFileId}`} alt={store.name} className={style === "centered" ? "h-14 w-auto" : "h-10 w-auto"} />
      ) : (
        store.name
      )}
    </Link>
  );
  const nav = <Nav store={store} pages={pages} hasItems={hasItems} style={style} designer={designer} />;
  const search = (
    <form action="/search" className="hidden sm:block">
      <input
        name="q"
        type="search"
        placeholder="Search"
        aria-label="Search"
        className={`w-36 border px-2.5 py-1 text-sm ${style === "bold" ? "border-white/30 bg-white/10 text-inherit placeholder:text-current/70" : "border-[var(--st-border)] bg-[var(--st-surface)]"}`}
        style={{ borderRadius: "min(var(--st-radius), 0.5rem)" }}
      />
    </form>
  );
  const actions = (
    <div className="flex items-center gap-4 text-sm">
      {style !== "centered" && search}
      {accounts && <Link href="/account" className="hover:opacity-80">{signedIn ? "My account" : "Sign in"}</Link>}
      <Link
        href="/cart"
        className={`px-3.5 py-1.5 font-semibold ${style === "bold" ? "bg-[var(--accent-contrast)] text-[var(--accent)]" : "bg-[var(--accent)] text-[var(--accent-contrast)]"}`}
        style={{ borderRadius: "var(--st-radius)" }}
        data-testid="cart-link"
      >
        Cart{cartCount ? ` (${cartCount})` : ""}
      </Link>
    </div>
  );

  if (style === "centered") {
    return (
      <header className="border-b border-[var(--st-border)] bg-[var(--st-surface)]">
        <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-4 px-4 pt-6 pb-4">
          <div>{search}</div>
          <div className="flex justify-center text-center">{logo}</div>
          <div className="flex justify-end">{actions}</div>
        </div>
        <div className="border-t border-[var(--st-border)]">
          <div className="mx-auto flex max-w-6xl justify-center px-4 py-3">{nav}</div>
        </div>
      </header>
    );
  }
  return (
    <header className={style === "bold" ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-md" : "border-b border-[var(--st-border)] bg-[var(--st-surface)]"}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4">
        {logo}
        <div className="flex-1">{nav}</div>
        {actions}
      </div>
    </header>
  );
}

function Nav({ store, pages, hasItems, style, designer }: { store: Store; pages: NavPage[]; hasItems: boolean; style: Theme["header"]; designer: boolean }) {
  // The blank catalog and quote requests are the business's own services, on its main site only.
  const main = store.kind === "ROOT";
  const href = (slug: string) => (slug === "home" ? "/" : `/${slug}`);
  const link = style === "bold" ? "st-heading text-base hover:opacity-80" : style === "centered" ? "text-xs font-medium tracking-[0.2em] uppercase hover:text-[var(--accent)]" : "hover:text-[var(--accent)]";
  return (
    <nav className={`flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium ${style === "centered" ? "justify-center gap-x-8" : ""}`} aria-label="Main">
      {hasItems && <Link href="/shop" className={link}>Shop</Link>}
      {designer && <Link href="/design" className={link}>Design your own</Link>}
      {main && <Link href="/catalog" className={link}>Catalog</Link>}
      {pages.map((p) =>
        p.children.length ? (
          <div key={p.id} className="group relative">
            <Link href={href(p.slug)} className={link}>{p.title} ▾</Link>
            <div className="invisible absolute left-0 z-20 min-w-44 border border-[var(--st-border)] bg-[var(--st-surface)] py-1 text-[var(--st-text)] shadow-lg group-focus-within:visible group-hover:visible" style={{ borderRadius: "min(var(--st-radius), 0.5rem)" }}>
              {p.children.map((c) => (
                <Link key={c.id} href={href(c.slug)} className="block px-3 py-1.5 normal-case hover:bg-[var(--st-subtle)]">{c.title}</Link>
              ))}
            </div>
          </div>
        ) : (
          <Link key={p.id} href={href(p.slug)} className={link}>{p.title}</Link>
        ),
      )}
      {main && <Link href="/quote" className={link}>Request a quote</Link>}
    </nav>
  );
}

export function StoreFooter({ business, store, pages }: { business: Business; store: Store; pages: Pick<StorePage, "id" | "slug" | "title">[] }) {
  const address = [business.addressLine1, [business.city, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  return (
    <footer className="mt-16 border-t border-[var(--st-border)] bg-[var(--st-footer-bg)] text-[var(--st-footer-text)]">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          <div className="st-heading text-base">{store.name}</div>
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
      <div className="pb-6 text-center text-xs opacity-60">Powered by {PLATFORM_NAME}</div>
    </footer>
  );
}
