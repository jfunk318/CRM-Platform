import "server-only";
import type { Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { DEFAULT_LAYOUTS, type LayoutItem, parseLayout, type Section } from "./widgets";

export class DashboardError extends Error {}

/** Where someone's dashboard came from, for the editor's wording. */
export type DashboardSource = { id: string | null; name: string; personal: boolean; locked: boolean; businessDefault: boolean };

const choiceOf = (db: BusinessDb, staffId: string, section: Section) =>
  db.staffDashboard.findUnique({ where: { staffId_section: { staffId, section } }, include: { layout: true } });

/**
 * The dashboard a staff member sees in a section: the one an admin locked
 * them to, else the one they chose, else the business default for the
 * section, else the built-in one.
 */
export async function dashboardFor(db: BusinessDb, staffId: string, section: Section): Promise<{ layout: LayoutItem[]; source: DashboardSource }> {
  const choice = await choiceOf(db, staffId, section);
  const chosen = choice?.layout ?? null;
  const fallback = chosen ? null : await db.dashboardLayout.findFirst({ where: { section, isDefault: true, ownerId: null } });
  const d = chosen ?? fallback;
  if (!d) return { layout: DEFAULT_LAYOUTS[section], source: { id: null, name: "Standard", personal: false, locked: false, businessDefault: false } };
  return {
    layout: parseLayout(d.widgets),
    source: { id: d.id, name: d.name, personal: d.ownerId === staffId, locked: !!choice?.locked && !!chosen, businessDefault: !chosen },
  };
}

/** Layouts someone can switch to in a section: its shared templates and their own. */
export const layoutChoices = (db: BusinessDb, staffId: string, section: Section) =>
  db.dashboardLayout.findMany({
    where: { section, OR: [{ ownerId: null }, { ownerId: staffId }] },
    orderBy: [{ ownerId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, ownerId: true, isDefault: true },
  });

async function checkUnlocked(db: BusinessDb, staffId: string, section: Section) {
  if ((await choiceOf(db, staffId, section))?.locked) throw new DashboardError("An admin has set this dashboard for you, so it can't be changed here");
}

const widgetsJson = (layout: LayoutItem[]) => {
  const clean = parseLayout(layout);
  if (clean.length === 0) throw new DashboardError("Add at least one widget");
  return clean as unknown as Prisma.InputJsonValue;
};

async function setChoice(db: BusinessDb, staffId: string, section: Section, layoutId: string | null, locked = false) {
  if (!layoutId) {
    await db.staffDashboard.deleteMany({ where: { staffId, section } });
    return;
  }
  await db.staffDashboard.upsert({
    where: { staffId_section: { staffId, section } },
    create: { businessId: db.$businessId, staffId, section, layoutId, locked },
    update: { layoutId, locked },
  });
}

/** Save someone's own dashboard for a section (their personal layout, made if needed) and use it. */
export async function saveMyDashboard(db: BusinessDb, staffId: string, section: Section, layout: LayoutItem[]) {
  await checkUnlocked(db, staffId, section);
  const widgets = widgetsJson(layout);
  const own = await db.dashboardLayout.findFirst({ where: { ownerId: staffId, section }, orderBy: { updatedAt: "desc" } });
  const saved = own
    ? await db.dashboardLayout.update({ where: { id: own.id }, data: { widgets } })
    : await db.dashboardLayout.create({ data: { businessId: db.$businessId, name: "My dashboard", section, widgets, ownerId: staffId } });
  await setChoice(db, staffId, section, saved.id);
  return saved.id;
}

/** Save a layout as a template everyone can use in its section (or update one of the same name). */
export async function saveTemplate(db: BusinessDb, section: Section, name: string, layout: LayoutItem[]) {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new DashboardError("Name the template");
  const widgets = widgetsJson(layout);
  const same = await db.dashboardLayout.findFirst({ where: { ownerId: null, section, name: { equals: clean, mode: "insensitive" } } });
  return same
    ? (await db.dashboardLayout.update({ where: { id: same.id }, data: { widgets } })).id
    : (await db.dashboardLayout.create({ data: { businessId: db.$businessId, name: clean, section, widgets } })).id;
}

/** A layout someone may use in a section: a shared template of it, or their own. */
async function checkUsable(db: BusinessDb, layoutId: string, staffId: string, section: Section) {
  const d = await db.dashboardLayout.findUnique({ where: { id: layoutId } });
  if (!d || d.section !== section || (d.ownerId && d.ownerId !== staffId)) throw new DashboardError("That dashboard isn't available here");
}

/** Switch to a template (or one's own layout) in a section; null = back to the business default. */
export async function chooseDashboard(db: BusinessDb, staffId: string, section: Section, layoutId: string | null) {
  await checkUnlocked(db, staffId, section);
  if (layoutId) await checkUsable(db, layoutId, staffId, section);
  await setChoice(db, staffId, section, layoutId);
}

/** Make a template its section's default (for everyone who hasn't chosen); null = the built-in one. */
export async function setBusinessDefault(db: BusinessDb, section: Section, layoutId: string | null) {
  if (layoutId) {
    const d = await db.dashboardLayout.findUnique({ where: { id: layoutId } });
    if (!d || d.ownerId || d.section !== section) throw new DashboardError("Only shared templates can be the default");
  }
  await db.$transaction([
    db.dashboardLayout.updateMany({ where: { section, isDefault: true }, data: { isDefault: false } }),
    ...(layoutId ? [db.dashboardLayout.update({ where: { id: layoutId }, data: { isDefault: true } })] : []),
  ]);
}

/** Delete a shared template; whoever used it goes back to the default. */
export async function deleteTemplate(db: BusinessDb, layoutId: string) {
  const d = await db.dashboardLayout.findUnique({ where: { id: layoutId } });
  if (!d || d.ownerId) throw new DashboardError("That template is already gone");
  // Choices pointing at it go with it (cascade).
  await db.dashboardLayout.delete({ where: { id: layoutId } });
}

/** An admin sets someone's dashboard in a section (a template or their own, or the default when null), optionally locked. */
export async function assignDashboard(db: BusinessDb, staffId: string, section: Section, layoutId: string | null, locked: boolean) {
  if (layoutId) await checkUsable(db, layoutId, staffId, section);
  await setChoice(db, staffId, section, layoutId, locked);
}
