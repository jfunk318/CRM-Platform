import type { StaffRole } from "@prisma/client";
import { hasAnyRole } from "@/lib/auth/roles";

/**
 * The dashboard's building blocks. A layout is a list of widgets in order,
 * each full, half or a third of the width; the page renders them in a
 * grid. Widgets someone's roles don't allow are skipped.
 */
export type WidgetSize = "full" | "half" | "third";
export type LayoutItem = { key: WidgetKey; size: WidgetSize };

export const WIDGETS = {
  "create-quote": { title: "Create a quote", description: "Start a quote for a customer, or a webstore quote.", roles: ["SALES"], size: "half" },
  "quick-actions": { title: "Quick actions", description: "Buttons for what you do most.", roles: [], size: "half" },
  "my-tasks": { title: "My tasks", description: "Due today and overdue.", roles: [], size: "full" },
  "assigned-to-me": { title: "Assigned to me", description: "Open quotes and orders assigned to you.", roles: [], size: "full" },
  "floor-stats": { title: "Shop floor", description: "Jobs today and late, purchase orders, low stock, ready to go out.", roles: ["PRODUCTION", "PURCHASING", "SHIPPING"], size: "full" },
  "sales-snapshot": { title: "Sales this month", description: "Booked, open quotes and what's waiting to be paid.", roles: ["ADMIN"], size: "full" },
  "recent-quotes": { title: "Recent quotes", description: "The latest quotes and where they stand.", roles: ["SALES"], size: "half" },
  "due-soon": { title: "Due this week", description: "Open orders due in the next 7 days.", roles: [], size: "half" },
  "store-requests": { title: "Store requests", description: "New requests from store owners.", roles: ["STORE_MANAGER"], size: "half" },
  "setup-check": { title: "Setup reminders", description: "Things to finish setting up, like placeholder prices.", roles: ["ADMIN"], size: "full" },
} satisfies Record<string, { title: string; description: string; roles: StaffRole[]; size: WidgetSize }>;

export type WidgetKey = keyof typeof WIDGETS;
export const WIDGET_KEYS = Object.keys(WIDGETS) as WidgetKey[];
const SIZES: WidgetSize[] = ["full", "half", "third"];

/** The dashboard everyone starts with, until they (or an admin) choose another. */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { key: "setup-check", size: "full" },
  { key: "create-quote", size: "half" },
  { key: "quick-actions", size: "half" },
  { key: "floor-stats", size: "full" },
  { key: "my-tasks", size: "full" },
  { key: "assigned-to-me", size: "full" },
];

/** A stored layout, cleaned: known widgets only, each once, with a valid size. */
export function parseLayout(raw: unknown): LayoutItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const r of raw) {
    const key = (r as { key?: unknown })?.key;
    const size = (r as { size?: unknown })?.size;
    if (typeof key !== "string" || !(key in WIDGETS) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key: key as WidgetKey, size: SIZES.includes(size as WidgetSize) ? (size as WidgetSize) : WIDGETS[key as WidgetKey].size });
  }
  return out;
}

/** What this person can see of a layout. */
export const visibleTo = (layout: LayoutItem[], roles: StaffRole[]) => layout.filter((i) => hasAnyRole(roles, WIDGETS[i.key].roles));

/** Widgets this person may add. */
export const availableTo = (roles: StaffRole[]) => WIDGET_KEYS.filter((k) => hasAnyRole(roles, WIDGETS[k].roles));
