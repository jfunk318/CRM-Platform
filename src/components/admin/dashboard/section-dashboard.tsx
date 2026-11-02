import { Fragment } from "react";
import type { StaffContext } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { dashboardFor, layoutChoices } from "@/lib/dashboard/layouts";
import { availableTo, type Section, visibleTo, WIDGETS, type WidgetKey } from "@/lib/dashboard/widgets";
import { DashboardBoard } from "./board";
import { renderWidget } from "./widgets";

/** A section's dashboard (Sales, Production or Web): each person's arrangement of widgets, Customize to change it. */
export async function SectionDashboard({ staff, section, title, edit }: { staff: StaffContext; section: Section; title?: string; edit?: string }) {
  const { db } = staff;
  const { layout, source } = await dashboardFor(db, staff.id, section);
  const editing = edit === "1" && !source.locked;
  const shown = visibleTo(layout, staff.roles);
  const available = availableTo(staff.roles);
  // Editing shows every widget for real, so adding one is what you get.
  const keys: WidgetKey[] = editing ? available : shown.map((i) => i.key);
  // Keyed, as elements handed to the board (a client component) must be.
  const rendered = Object.fromEntries(
    await Promise.all(
      keys.map(async (k) => {
        const node = await renderWidget(k, staff);
        return [k, node === null ? null : <Fragment key={k}>{node}</Fragment>] as const;
      }),
    ),
  );
  return (
    <DashboardBoard
      // Remount when the saved layout changes, so the editor starts from it.
      key={`${source.id}-${JSON.stringify(shown)}-${editing}`}
      section={section}
      title={title}
      name={staff.name}
      layout={shown}
      rendered={rendered}
      widgets={available.map((k) => ({ key: k, title: WIDGETS[k].title, description: WIDGETS[k].description }))}
      source={source}
      choices={await layoutChoices(db, staff.id, section)}
      isAdmin={hasAnyRole(staff.roles, ["ADMIN"])}
      editing={editing}
    />
  );
}
