import type { StaffRole } from "@prisma/client";

/**
 * The back office's sections. Sales, Production and Web are the day-to-day
 * work, switched at the top of the menu; Admin (setup: staff, settings,
 * catalog and pricing, payments) and Reporting sit at the bottom.
 */
export type AdminArea = "sales" | "production" | "web" | "admin" | "reporting";

export const AREAS: { id: AdminArea; label: string; place: "top" | "bottom" }[] = [
  { id: "sales", label: "Sales", place: "top" },
  { id: "production", label: "Production", place: "top" },
  { id: "web", label: "Web", place: "top" },
  { id: "admin", label: "Admin", place: "bottom" },
  { id: "reporting", label: "Reporting", place: "bottom" },
];

/** `requests`: the live count of new store requests. `tasks`: my tasks due. `group`: a collapsible heading within the section. */
export type NavItem = { href: string; label: string; area: AdminArea; roles: StaffRole[]; group?: string; requests?: boolean; tasks?: boolean };

export const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", area: "sales", roles: [] },
  { href: "/admin/tasks", label: "Tasks", area: "sales", roles: [], tasks: true },
  { href: "/admin/leads", label: "Leads", area: "sales", roles: ["SALES"] },
  { href: "/admin/pipeline", label: "Pipeline", area: "sales", roles: ["SALES"] },
  { href: "/admin/orders?type=QUOTE", label: "Quotes", area: "sales", roles: ["SALES"] },
  { href: "/admin/orders?type=ORDER", label: "Orders", area: "sales", roles: [] },
  { href: "/admin/customers", label: "Customers", area: "sales", roles: ["SALES"] },
  { href: "/admin/price-check", label: "Price check", area: "sales", roles: ["SALES"] },

  { href: "/admin/production", label: "Production board", area: "production", roles: ["PRODUCTION"] },
  { href: "/admin/production/calendar", label: "Calendar", area: "production", roles: ["PRODUCTION"] },
  { href: "/admin/shipping", label: "Shipping", area: "production", roles: ["SHIPPING"] },
  { href: "/admin/purchasing", label: "Purchasing", area: "production", roles: ["PURCHASING"] },
  { href: "/admin/inventory", label: "Inventory", area: "production", roles: ["PURCHASING"] },
  { href: "/admin/suppliers", label: "Suppliers", area: "production", roles: ["PURCHASING"] },

  { href: "/admin/stores", label: "All stores", area: "web", roles: ["STORE_MANAGER"], requests: true },
  { href: "/admin/stores/groups", label: "Store groups", area: "web", roles: ["STORE_MANAGER"] },
  { href: "/admin/stores/main-site", label: "Main site", area: "web", roles: ["STORE_MANAGER"] },
  { href: "/admin/stores/promo-codes", label: "Promo codes", area: "web", roles: ["STORE_MANAGER"] },
  { href: "/admin/stores/gift-codes", label: "Gift codes", area: "web", roles: ["STORE_MANAGER"] },

  { href: "/admin/settings", label: "Shop & tax", area: "admin", roles: ["ADMIN"], group: "Business" },
  { href: "/admin/staff", label: "Staff & permissions", area: "admin", roles: ["ADMIN"], group: "Business" },
  { href: "/admin/order-statuses", label: "Order statuses", area: "admin", roles: ["ADMIN"], group: "Business" },
  { href: "/admin/delivery-methods", label: "Delivery methods", area: "admin", roles: ["ADMIN"], group: "Business" },
  { href: "/admin/automations", label: "Automations", area: "admin", roles: ["ADMIN"], group: "Business" },
  { href: "/admin/products", label: "Products", area: "admin", roles: ["SALES", "PURCHASING"], group: "Catalog & pricing" },
  { href: "/admin/categories", label: "Categories", area: "admin", roles: ["SALES"], group: "Catalog & pricing" },
  { href: "/admin/methods", label: "Decoration methods", area: "admin", roles: ["SALES", "PRODUCTION"], group: "Catalog & pricing" },
  { href: "/admin/pricing", label: "Pricing", area: "admin", roles: ["SALES"], group: "Catalog & pricing" },
  { href: "/admin/placement-guides", label: "Placement guides", area: "admin", roles: ["ADMIN"], group: "Catalog & pricing" },
  { href: "/admin/stores/settings", label: "Payments & store defaults", area: "admin", roles: ["ADMIN"], group: "Integrations" },

  { href: "/admin/reports", label: "Sales", area: "reporting", roles: ["ADMIN"] },
  { href: "/admin/reports/production", label: "Production", area: "reporting", roles: ["PRODUCTION"] },
  { href: "/admin/reports/stores", label: "Stores", area: "reporting", roles: ["STORE_MANAGER"] },
];

/** The menu item a page belongs to: the longest matching path, then a matching ?type=. */
export function activeHref(items: { href: string }[], pathname: string, search: URLSearchParams): string | null {
  let best: { href: string; score: number } | null = null;
  for (const item of items) {
    const [path, query] = item.href.split("?");
    const under = pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
    if (!under) continue;
    const params = new URLSearchParams(query ?? "");
    const queryMatches = [...params].every(([k, v]) => search.get(k) === v);
    const score = path.length * 2 + (query && queryMatches ? 1 : 0);
    if (!best || score > best.score) best = { href: item.href, score };
  }
  return best?.href ?? null;
}

/** Which section a page is in: its menu item's, else by address (store pages under Web, reports under Reporting), else Sales. */
export function areaFor(items: { href: string; area: AdminArea }[], href: string | null, pathname: string): AdminArea {
  const item = href ? items.find((i) => i.href === href) : undefined;
  if (item) return item.area;
  if (pathname.startsWith("/admin/stores")) return "web";
  if (pathname.startsWith("/admin/reports")) return "reporting";
  return "sales";
}
