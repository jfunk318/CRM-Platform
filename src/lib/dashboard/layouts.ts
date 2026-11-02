import "server-only";
import type { Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { DEFAULT_LAYOUT, type LayoutItem, parseLayout } from "./widgets";

export class DashboardError extends Error {}

/** Where someone's dashboard came from, for the editor's wording. */
export type DashboardSource = { id: string | null; name: string; personal: boolean; locked: boolean; businessDefault: boolean };

/**
 * The dashboard a staff member sees: the one an admin locked them to, else
 * the one they chose, else the business default, else the built-in one.
 */
export async function dashboardFor(db: BusinessDb, staffId: string): Promise<{ layout: LayoutItem[]; source: DashboardSource }> {
  const staff = await db.staffUser.findUniqueOrThrow({ where: { id: staffId }, select: { dashboardLocked: true, dashboard: true } });
  const chosen = staff.dashboard;
  const fallback = chosen ? null : await db.dashboardLayout.findFirst({ where: { isDefault: true, ownerId: null } });
  const d = chosen ?? fallback;
  if (!d) return { layout: DEFAULT_LAYOUT, source: { id: null, name: "Standard", personal: false, locked: false, businessDefault: false } };
  return {
    layout: parseLayout(d.widgets),
    source: { id: d.id, name: d.name, personal: d.ownerId === staffId, locked: staff.dashboardLocked && !!chosen, businessDefault: !chosen },
  };
}

/** Layouts someone can switch to: shared templates and their own. */
export const layoutChoices = (db: BusinessDb, staffId: string) =>
  db.dashboardLayout.findMany({ where: { OR: [{ ownerId: null }, { ownerId: staffId }] }, orderBy: [{ ownerId: "asc" }, { name: "asc" }], select: { id: true, name: true, ownerId: true, isDefault: true } });

async function checkUnlocked(db: BusinessDb, staffId: string) {
  const s = await db.staffUser.findUniqueOrThrow({ where: { id: staffId }, select: { dashboardLocked: true } });
  if (s.dashboardLocked) throw new DashboardError("An admin has set your dashboard, so it can't be changed here");
}

const widgetsJson = (layout: LayoutItem[]) => {
  const clean = parseLayout(layout);
  if (clean.length === 0) throw new DashboardError("Add at least one widget");
  return clean as unknown as Prisma.InputJsonValue;
};

/** Save someone's own dashboard (their personal layout, made if needed) and use it. */
export async function saveMyDashboard(db: BusinessDb, staffId: string, layout: LayoutItem[]) {
  await checkUnlocked(db, staffId);
  const widgets = widgetsJson(layout);
  const own = await db.dashboardLayout.findFirst({ where: { ownerId: staffId }, orderBy: { updatedAt: "desc" } });
  const saved = own
    ? await db.dashboardLayout.update({ where: { id: own.id }, data: { widgets } })
    : await db.dashboardLayout.create({ data: { businessId: db.$businessId, name: "My dashboard", widgets, ownerId: staffId } });
  await db.staffUser.update({ where: { id: staffId }, data: { dashboardId: saved.id } });
  return saved.id;
}

/** Save a layout as a template everyone can use (or update one of the same name). */
export async function saveTemplate(db: BusinessDb, name: string, layout: LayoutItem[]) {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new DashboardError("Name the template");
  const widgets = widgetsJson(layout);
  const same = await db.dashboardLayout.findFirst({ where: { ownerId: null, name: { equals: clean, mode: "insensitive" } } });
  return same
    ? (await db.dashboardLayout.update({ where: { id: same.id }, data: { widgets } })).id
    : (await db.dashboardLayout.create({ data: { businessId: db.$businessId, name: clean, widgets } })).id;
}

/** Switch to a template (or one's own layout); null = back to the business default. */
export async function chooseDashboard(db: BusinessDb, staffId: string, layoutId: string | null) {
  await checkUnlocked(db, staffId);
  if (layoutId) {
    const d = await db.dashboardLayout.findUnique({ where: { id: layoutId } });
    if (!d || (d.ownerId && d.ownerId !== staffId)) throw new DashboardError("That dashboard isn't available");
  }
  await db.staffUser.update({ where: { id: staffId }, data: { dashboardId: layoutId } });
}

/** Make a template the business default (for everyone who hasn't chosen one); null = the built-in one. */
export async function setBusinessDefault(db: BusinessDb, layoutId: string | null) {
  if (layoutId) {
    const d = await db.dashboardLayout.findUnique({ where: { id: layoutId } });
    if (!d || d.ownerId) throw new DashboardError("Only shared templates can be the default");
  }
  await db.$transaction([
    db.dashboardLayout.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    ...(layoutId ? [db.dashboardLayout.update({ where: { id: layoutId }, data: { isDefault: true } })] : []),
  ]);
}

/** Delete a shared template; whoever used it goes back to the default. */
export async function deleteTemplate(db: BusinessDb, layoutId: string) {
  const d = await db.dashboardLayout.findUnique({ where: { id: layoutId } });
  if (!d || d.ownerId) throw new DashboardError("That template is already gone");
  await db.$transaction([
    db.staffUser.updateMany({ where: { dashboardId: layoutId }, data: { dashboardId: null, dashboardLocked: false } }),
    db.dashboardLayout.delete({ where: { id: layoutId } }),
  ]);
}

/** An admin sets someone's dashboard (a template, or the default when null), optionally locked. */
export async function assignDashboard(db: BusinessDb, staffId: string, layoutId: string | null, locked: boolean) {
  if (layoutId) {
    const d = await db.dashboardLayout.findUnique({ where: { id: layoutId } });
    if (!d || (d.ownerId && d.ownerId !== staffId)) throw new DashboardError("Choose a shared template");
  }
  await db.staffUser.update({ where: { id: staffId }, data: { dashboardId: layoutId, dashboardLocked: locked && !!layoutId } });
}
