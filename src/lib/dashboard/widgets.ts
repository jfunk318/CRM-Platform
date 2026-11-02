import type { StaffRole } from "@prisma/client";
import { hasAnyRole } from "@/lib/auth/roles";

/**
 * The dashboards' building blocks. Sales, Production and Web each have a
 * dashboard; a layout is a list of widgets in order, each full, half or a
 * third of the width, rendered in a grid. Any widget can go on any
 * dashboard; widgets someone's roles don't allow are skipped.
 */
export type Section = "sales" | "production" | "web";
export const SECTIONS: Record<Section, { label: string; path: string }> = {
  sales: { label: "Sales", path: "/admin" },
  production: { label: "Production", path: "/admin/production/dashboard" },
  web: { label: "Web", path: "/admin/stores/dashboard" },
};
export const isSection = (s: unknown): s is Section => typeof s === "string" && s in SECTIONS;

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
  "production-actions": { title: "Production shortcuts", description: "Board, calendar, purchasing, shipping and work orders.", roles: ["PRODUCTION", "PURCHASING", "SHIPPING"], size: "half" },
  "jobs-today": { title: "On today's schedule", description: "Jobs scheduled for today, with their next step.", roles: ["PRODUCTION"], size: "half" },
  "late-jobs": { title: "Late jobs", description: "Open jobs past their order's due date.", roles: ["PRODUCTION"], size: "half" },
  "in-progress": { title: "In progress", description: "Jobs being worked on now.", roles: ["PRODUCTION"], size: "half" },
  "ready-to-ship": { title: "Ready to go out", description: "Orders ready for pickup or shipping.", roles: ["SHIPPING"], size: "half" },
  "low-stock": { title: "Low stock", description: "Blanks at or below their reorder point.", roles: ["PURCHASING"], size: "half" },
  "web-actions": { title: "Webstore shortcuts", description: "New store, store list, codes and the main site.", roles: ["STORE_MANAGER"], size: "half" },
  "web-snapshot": { title: "Online this month", description: "Online sales, orders, store visits and commission owed.", roles: ["STORE_MANAGER"], size: "full" },
  "closing-soon": { title: "Stores closing soon", description: "Stores that close in the next 14 days.", roles: ["STORE_MANAGER"], size: "half" },
  "online-orders": { title: "Latest online orders", description: "What shoppers just ordered, store by store.", roles: ["STORE_MANAGER"], size: "half" },
  "batches-waiting": { title: "Waiting to batch", description: "Closed stores with orders still held for their batch.", roles: ["STORE_MANAGER"], size: "half" },
} satisfies Record<string, { title: string; description: string; roles: StaffRole[]; size: WidgetSize }>;

export type WidgetKey = keyof typeof WIDGETS;
export const WIDGET_KEYS = Object.keys(WIDGETS) as WidgetKey[];
const SIZES: WidgetSize[] = ["full", "half", "third"];

/** Each section's dashboard until someone (or an admin) chooses another. */
export const DEFAULT_LAYOUTS: Record<Section, LayoutItem[]> = {
  sales: [
    { key: "setup-check", size: "full" },
    { key: "create-quote", size: "half" },
    { key: "quick-actions", size: "half" },
    { key: "sales-snapshot", size: "full" },
    { key: "my-tasks", size: "full" },
    { key: "assigned-to-me", size: "full" },
    { key: "recent-quotes", size: "half" },
    { key: "due-soon", size: "half" },
  ],
  production: [
    { key: "floor-stats", size: "full" },
    { key: "jobs-today", size: "half" },
    { key: "late-jobs", size: "half" },
    { key: "in-progress", size: "half" },
    { key: "production-actions", size: "half" },
    { key: "ready-to-ship", size: "half" },
    { key: "low-stock", size: "half" },
    { key: "due-soon", size: "full" },
  ],
  web: [
    { key: "web-snapshot", size: "full" },
    { key: "store-requests", size: "half" },
    { key: "web-actions", size: "half" },
    { key: "closing-soon", size: "half" },
    { key: "batches-waiting", size: "half" },
    { key: "online-orders", size: "full" },
  ],
};
/** The Sales dashboard's default. */
export const DEFAULT_LAYOUT = DEFAULT_LAYOUTS.sales;

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
