"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState } from "react";

export type SideNavItem = { href: string; label: string; group?: string; badge?: React.ReactNode };

const STORAGE_KEY = "admin-nav-open";

/** A page's say in which menu item it belongs to, when its address can't tell (a quote vs an order). */
const HintContext = createContext<{ hint: string | null; setHint: (href: string | null) => void }>({ hint: null, setHint: () => {} });

/** Wraps the menu and the page, so a page can hint at its menu item. */
export function NavProvider({ children }: { children: React.ReactNode }) {
  const [hint, setHint] = useState<string | null>(null);
  return <HintContext.Provider value={{ hint, setHint }}>{children}</HintContext.Provider>;
}

/** Put on a page to highlight `href` in the menu while it's open. */
export function NavHint({ href }: { href: string }) {
  const { setHint } = useContext(HintContext);
  useEffect(() => {
    setHint(href);
    return () => setHint(null);
  }, [href, setHint]);
  return null;
}

/** Which item the current page belongs to: the longest matching path, then a matching ?type=. */
function activeHref(items: SideNavItem[], pathname: string, search: URLSearchParams): string | null {
  let best: { href: string; score: number } | null = null;
  for (const item of items) {
    const [path, query] = item.href.split("?");
    const under = pathname === path || (path !== "/admin" && path !== "/admin/stores" && pathname.startsWith(`${path}/`));
    if (!under) continue;
    const params = new URLSearchParams(query ?? "");
    const queryMatches = [...params].every(([k, v]) => search.get(k) === v);
    const score = path.length * 2 + (query && queryMatches ? 1 : 0);
    if (!best || score > best.score) best = { href: item.href, score };
  }
  return best?.href ?? null;
}

/**
 * The back office's left menu: loose items first, then collapsible groups.
 * The group holding the current page is always open; the others remember
 * whether they were opened (per browser).
 */
export function SideNav(props: { items: SideNavItem[]; label: string }) {
  return (
    <Suspense fallback={<Menu {...props} pathname="" search={new URLSearchParams()} />}>
      <CurrentMenu {...props} />
    </Suspense>
  );
}

function CurrentMenu(props: { items: SideNavItem[]; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  return <Menu {...props} pathname={pathname} search={new URLSearchParams(search.toString())} />;
}

function Menu({ items, label, pathname, search }: { items: SideNavItem[]; label: string; pathname: string; search: URLSearchParams }) {
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setOpen(saved.filter((g): g is string => typeof g === "string"));
    } catch {
      // No storage (private window and the like): groups start closed.
    }
  }, []);
  const toggle = (group: string) =>
    setOpen((list) => {
      const next = list.includes(group) ? list.filter((g) => g !== group) : [...list, group];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not remembered; fine.
      }
      return next;
    });

  const { hint } = useContext(HintContext);
  const active = hint && items.some((i) => i.href === hint) ? hint : activeHref(items, pathname, search);
  const loose = items.filter((i) => !i.group);
  const groups = [...new Set(items.flatMap((i) => (i.group ? [i.group] : [])))];
  const link = (i: SideNavItem, nested = false) => (
    <Link
      key={i.href}
      href={i.href}
      aria-current={i.href === active ? "page" : undefined}
      className={`flex items-center rounded px-2 py-1.5 text-sm ${nested ? "pl-5" : ""} ${i.href === active ? "bg-amber-50 font-medium text-amber-900" : "text-gray-700 hover:bg-amber-50"}`}
    >
      {i.label}
      {i.badge}
    </Link>
  );

  return (
    <nav className="flex flex-col gap-0.5 px-2 pb-3" aria-label={label} data-testid="side-nav">
      {loose.map((i) => link(i))}
      {groups.map((g) => {
        const members = items.filter((i) => i.group === g);
        const here = members.some((i) => i.href === active);
        const isOpen = here || open.includes(g);
        const id = `nav-${g.toLowerCase().replace(/\W+/g, "-")}`;
        return (
          <div key={g} className="mt-1" data-testid="nav-group">
            <button
              type="button"
              onClick={() => toggle(g)}
              disabled={here}
              aria-expanded={isOpen}
              aria-controls={id}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase hover:bg-gray-50 hover:text-gray-800 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="flex items-center">
                {g}
                {/* Badges stay visible on a closed group. */}
                {!isOpen && members.map((m) => m.badge && <span key={m.href}>{m.badge}</span>)}
              </span>
              <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden="true">
                <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isOpen && (
              <div id={id} className="flex flex-col gap-0.5">
                {members.map((i) => link(i, true))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
