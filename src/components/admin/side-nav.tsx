"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState } from "react";
import { activeHref, type AdminArea, AREAS, areaFor } from "@/lib/admin/nav";

export type SideNavItem = { href: string; label: string; area: AdminArea; group?: string; badge?: React.ReactNode };

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

type Props = { items: SideNavItem[]; areaBadges?: Partial<Record<AdminArea, React.ReactNode>> };

/**
 * The back office's left menu: the section switcher (Sales, Production,
 * Web) on top, the open section's items (loose ones first, then
 * collapsible groups) and Admin and Reporting at the bottom. The section
 * follows the page you're on.
 */
export function SideNav(props: Props) {
  return (
    <Suspense fallback={<Menu {...props} pathname="" search={new URLSearchParams()} />}>
      <CurrentMenu {...props} />
    </Suspense>
  );
}

function CurrentMenu(props: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  return <Menu {...props} pathname={pathname} search={new URLSearchParams(search.toString())} />;
}

function Menu({ items, areaBadges = {}, pathname, search }: Props & { pathname: string; search: URLSearchParams }) {
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
  const area = areaFor(items, active, pathname);
  // Sections this person has anything in, each opening on its first item.
  const sections = AREAS.flatMap((a) => {
    const first = items.find((i) => i.area === a.id);
    return first ? [{ ...a, home: first.href }] : [];
  });
  const top = sections.filter((s) => s.place === "top");
  const bottom = sections.filter((s) => s.place === "bottom");
  const here = items.filter((i) => i.area === area);
  const loose = here.filter((i) => !i.group);
  const groups = [...new Set(here.flatMap((i) => (i.group ? [i.group] : [])))];
  const sectionLabel = AREAS.find((a) => a.id === area)?.label ?? "Menu";

  const link = (i: SideNavItem, nested = false) => (
    <Link
      key={i.href}
      href={i.href}
      aria-current={i.href === active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm transition-colors ${i.href === active ? "bg-brand-600 font-semibold text-white" : "text-gray-300 hover:bg-espresso-raised hover:text-white"}`}
    >
      {nested && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i.href === active ? "bg-wheat" : "bg-transparent"}`} aria-hidden="true" />}
      {i.label}
      {i.badge}
    </Link>
  );
  const tab = (s: (typeof sections)[number], cls: string) => (
    <Link
      key={s.id}
      href={s.home}
      aria-current={s.id === area ? "true" : undefined}
      className={`flex items-center justify-center rounded-md px-2 py-1.5 transition-colors ${s.id === area ? "bg-gray-100 text-gray-900" : "text-gray-300 hover:text-white"} ${cls}`}
      data-testid={`area-${s.id}`}
    >
      {s.label}
      {s.id !== area && areaBadges[s.id]}
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col">
      {top.length > 1 && (
        <div className="mx-3 mb-4 flex gap-1 rounded-lg bg-espresso-raised p-1 text-xs font-medium" role="navigation" aria-label="Sections" data-testid="area-switcher">
          {top.map((s) => tab(s, "flex-1"))}
        </div>
      )}
      <nav className="flex flex-col gap-0.5 px-3 pb-4" aria-label={sectionLabel} data-testid="side-nav">
        {area !== "sales" && area !== "production" && area !== "web" && (
          <div className="px-2.5 pb-1 text-xs font-medium text-wheat" data-testid="section-label">{sectionLabel}</div>
        )}
        {loose.map((i) => link(i))}
        {groups.map((g) => {
          const members = here.filter((i) => i.group === g);
          const current = members.some((i) => i.href === active);
          const isOpen = current || open.includes(g);
          const id = `nav-${g.toLowerCase().replace(/\W+/g, "-")}`;
          return (
            <div key={g} className="mt-3" data-testid="nav-group">
              <button
                type="button"
                onClick={() => toggle(g)}
                disabled={current}
                aria-expanded={isOpen}
                aria-controls={id}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-espresso-raised hover:text-white disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-gray-400"
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
      {bottom.length > 0 && (
        <div className="mx-3 mt-auto mb-3 grid grid-cols-2 gap-1 rounded-lg bg-espresso-raised p-1 text-xs font-medium" role="navigation" aria-label="Admin and reporting" data-testid="area-bottom">
          {bottom.map((s) => tab(s, bottom.length === 1 ? "col-span-2" : ""))}
        </div>
      )}
    </div>
  );
}
