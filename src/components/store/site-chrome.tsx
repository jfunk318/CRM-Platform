import Link from "next/link";
import type { Business, Store, StorePage } from "@prisma/client";
import { PLATFORM_NAME } from "@/lib/platform";
import type { SiteSettings } from "@/lib/store/homepage";
import { CloseMenuOnNavigate } from "./close-menu";
import { SocialLinks } from "./home-sections";

type NavPage = Pick<StorePage, "id" | "slug" | "title"> & { children: Pick<StorePage, "id" | "slug" | "title">[] };
export type SiteLinkItem = { href: string; label: string; children?: { href: string; label: string }[] };

/**
 * The menu for the business's main site: its shop, the team-store
 * directory, the homepage's sections (services, about, contact), the
 * catalog and its own pages.
 */
export function siteMenu(o: { pages: NavPage[]; anchors: Set<string>; hasItems: boolean; hasStores: boolean; designer: boolean; site: SiteSettings }): SiteLinkItem[] {
  const href = (slug: string) => (slug === "home" ? "/" : `/${slug}`);
  return [
    ...(o.hasItems ? [{ href: "/shop", label: "Shop" }] : []),
    ...(o.hasStores && o.site.storesLink ? [{ href: "/stores", label: "Team stores" }] : []),
    ...(o.anchors.has("services") ? [{ href: "/#services", label: "Services" }] : []),
    { href: "/catalog", label: "Catalog" },
    ...(o.designer ? [{ href: "/design", label: "Design your own" }] : []),
    ...(o.anchors.has("work") ? [{ href: "/#work", label: "Our work" }] : []),
    ...(o.anchors.has("about") ? [{ href: "/#about", label: "About" }] : []),
    ...o.pages.map((p) => ({ href: href(p.slug), label: p.title, children: p.children.map((c) => ({ href: href(c.slug), label: c.title })) })),
    ...(o.anchors.has("contact") ? [{ href: "/#contact", label: "Contact" }] : []),
  ];
}

const Icon = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={d} />
  </svg>
);
const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3";
const USER = "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z";
const BAG = "M6 7h12l1 14H5L6 7Zm3 0a3 3 0 0 1 6 0";
const MENU = "M4 7h16M4 12h16M4 17h16";

/** A sticky, see-through header with a full menu on wide screens and a drop-down one on phones. */
export function SiteHeader({ store, menu, site, cartCount, signedIn, accounts }: { store: Store; menu: SiteLinkItem[]; site: SiteSettings; cartCount: number; signedIn: boolean; accounts: boolean }) {
  const logo = (
    <Link href="/" className="st-heading flex shrink-0 items-center gap-2 text-xl font-bold" data-testid="store-logo">
      {store.logoFileId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/media/${store.logoFileId}`} alt={store.name} className="h-10 w-auto" />
      ) : (
        store.name
      )}
    </Link>
  );
  const button = site.headerButton.href ? site.headerButton : null;
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--st-border)] bg-[color-mix(in_srgb,var(--st-surface)_88%,transparent)] backdrop-blur-md" data-testid="site-header">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        {logo}
        <nav className="hidden flex-1 items-center justify-center gap-1 text-sm font-medium lg:flex" aria-label="Main">
          {menu.map((m) =>
            m.children?.length ? (
              <div key={m.href} className="group relative">
                <Link href={m.href} className="rounded-full px-3 py-2 hover:bg-[var(--st-subtle)]">{m.label} ▾</Link>
                <div className="invisible absolute top-full left-0 z-20 min-w-48 border border-[var(--st-border)] bg-[var(--st-surface)] py-1 shadow-lg group-focus-within:visible group-hover:visible" style={{ borderRadius: "min(var(--st-radius), 0.75rem)" }}>
                  {m.children.map((c) => <Link key={c.href} href={c.href} className="block px-4 py-2 hover:bg-[var(--st-subtle)]">{c.label}</Link>)}
                </div>
              </div>
            ) : (
              <Link key={m.href} href={m.href} className="rounded-full px-3 py-2 hover:bg-[var(--st-subtle)]">{m.label}</Link>
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Link href="/search" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--st-subtle)]" aria-label="Search"><Icon d={SEARCH} /></Link>
          {accounts && <Link href="/account" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--st-subtle)]" aria-label={signedIn ? "My account" : "Sign in"} title={signedIn ? "My account" : "Sign in"}><Icon d={USER} /></Link>}
          <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--st-subtle)]" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`} data-testid="cart-link">
            <Icon d={BAG} />
            {cartCount > 0 && <span className="absolute top-1 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--accent-contrast)]">{cartCount}</span>}
          </Link>
          {button && <Link href={button.href} className="st-btn ml-2 hidden !rounded-full sm:inline-flex" data-testid="header-button">{button.label}</Link>}
          <details className="group relative lg:hidden" id="site-menu" data-testid="mobile-menu">
            <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-[var(--st-subtle)] [&::-webkit-details-marker]:hidden" aria-label="Menu"><Icon d={MENU} /></summary>
            <div className="fixed inset-x-0 top-16 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-[var(--st-border)] bg-[var(--st-surface)] px-4 pb-6 shadow-xl">
              <nav className="flex flex-col divide-y divide-[var(--st-border)] text-base font-medium" aria-label="Menu">
                {menu.flatMap((m) => [m, ...(m.children ?? []).map((c) => ({ ...c, child: true }))]).map((m) => (
                  <Link key={m.href} href={m.href} className={`py-3 ${"child" in m ? "pl-4 text-sm text-[var(--st-muted)]" : ""}`}>{m.label}</Link>
                ))}
              </nav>
              {button && <Link href={button.href} className="st-btn mt-4 w-full">{button.label}</Link>}
              <SocialLinks site={site} className="mt-4 justify-center" />
            </div>
          </details>
          <CloseMenuOnNavigate id="site-menu" />
        </div>
      </div>
    </header>
  );
}

/** The main site's footer: about line, quick links, contact and social links. */
export function SiteFooter({ business, store, menu, site }: { business: Business; store: Store; menu: SiteLinkItem[]; site: SiteSettings }) {
  const address = [business.addressLine1, [business.city, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-[var(--st-footer-bg)] text-[var(--st-footer-text)]" data-testid="site-footer">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 text-sm md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="st-heading text-xl">{store.name}</div>
          <p className="max-w-xs leading-relaxed whitespace-pre-wrap opacity-90">{store.footerText || store.tagline || "Custom apparel and merchandise, printed in-house."}</p>
          <SocialLinks site={site} size="h-9 w-9" />
        </div>
        <FooterColumn title="Explore" links={menu.filter((m) => !m.href.includes("#contact")).slice(0, 7)} />
        <FooterColumn
          title="Help"
          links={[
            { href: "/quote", label: "Request a quote" },
            { href: "/track", label: "Track your order" },
            { href: "/account", label: "Your account" },
            { href: "/cart", label: "Cart" },
          ]}
        />
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-[0.2em] uppercase opacity-70">Contact</div>
          {address.map((l) => <div key={l}>{l}</div>)}
          {business.phone && <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="block hover:underline">{business.phone}</a>}
          {business.email && <a href={`mailto:${business.email}`} className="block break-all hover:underline">{business.email}</a>}
          {site.hours && <p className="pt-2 whitespace-pre-line opacity-80">{site.hours}</p>}
        </div>
      </div>
      <div className="border-t border-current/10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs opacity-60">
          <span>© {year} {business.name}</span>
          <span>Powered by {PLATFORM_NAME}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav className="flex flex-col gap-2" aria-label={title}>
      <div className="text-xs font-semibold tracking-[0.2em] uppercase opacity-70">{title}</div>
      {links.map((l) => <Link key={l.href} href={l.href} className="hover:underline">{l.label}</Link>)}
    </nav>
  );
}
