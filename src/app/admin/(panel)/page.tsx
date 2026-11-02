import { Fragment } from "react";
import { requireStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { dashboardFor, layoutChoices } from "@/lib/dashboard/layouts";
import { availableTo, visibleTo, WIDGETS, type WidgetKey } from "@/lib/dashboard/widgets";
import { DashboardBoard } from "@/components/admin/dashboard/board";
import { renderWidget } from "@/components/admin/dashboard/widgets";

/** The dashboard: each person's arrangement of widgets (Customize to change it). */
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; edit?: string }> }) {
  const staff = await requireStaff();
  const { db } = staff;
  const { denied, edit } = await searchParams;
  const { layout, source } = await dashboardFor(db, staff.id);
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
    <>
      {denied && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          You don&apos;t have access to that page. Ask an admin to add the role you need.
        </p>
      )}
      <DashboardBoard
        // Remount when the saved layout changes, so the editor starts from it.
        key={`${source.id}-${JSON.stringify(shown)}-${editing}`}
        name={staff.name}
        layout={shown}
        rendered={rendered}
        widgets={available.map((k) => ({ key: k, title: WIDGETS[k].title, description: WIDGETS[k].description }))}
        source={source}
        choices={await layoutChoices(db, staff.id)}
        isAdmin={hasAnyRole(staff.roles, ["ADMIN"])}
        editing={editing}
      />
    </>
  );
}
