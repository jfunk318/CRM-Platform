import type { StaffUser } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { ActionForm } from "@/components/admin/action-form";
import { ListRow } from "@/components/admin/list-row";
import { type Section, SECTIONS } from "@/lib/dashboard/widgets";
import { createStaff, saveStaff } from "./actions";

export default async function StaffPage() {
  const me = await requireStaff(["ADMIN"]);
  const { db } = me;
  const [staff, templates] = await Promise.all([
    db.staffUser.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { dashboards: { include: { layout: { select: { ownerId: true, name: true } } } } } }),
    db.dashboardLayout.findMany({ where: { ownerId: null }, orderBy: { name: "asc" }, select: { id: true, name: true, isDefault: true, section: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Staff &amp; permissions</h1>
        <p className="text-sm text-gray-500">
          Roles control which parts of the back office each person can use; admins can do everything. Edit someone to change their roles, password or dashboard.
        </p>
      </div>
      <div className="card divide-y divide-gray-100 p-0" data-testid="staff-list">
        {staff.map((s) => {
          // Dashboards set for them (others are the defaults).
          const dashboard = s.dashboards
            .filter((d) => d.layout)
            .map((d) => `${SECTIONS[d.section as Section]?.label ?? d.section}: ${d.layout!.ownerId ? "their own" : d.layout!.name}${d.locked ? " (locked)" : ""}`)
            .join(" · ") || "Default dashboards";
          return (
            <ListRow
              key={s.id}
              testId="staff-member"
              editor={
                <ActionForm action={saveStaff}>
                  <input type="hidden" name="id" value={s.id} />
                  <StaffFields user={s} />
                  <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                    <div>
                      <label className="label" htmlFor={`pw-${s.id}`}>Reset password (optional)</label>
                      <input className="input" id={`pw-${s.id}`} name="password" type="password" autoComplete="new-password" />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={s.active} disabled={s.id === me.id} />
                      Active
                      {s.id === me.id && <input type="hidden" name="active" value="on" />}
                    </label>
                  </div>
                  <fieldset data-testid="staff-dashboard">
                    <legend className="label">Dashboards</legend>
                    <div className="space-y-2">
                      {(Object.keys(SECTIONS) as Section[]).map((section) => {
                        const choice = s.dashboards.find((d) => d.section === section);
                        const own = choice?.layout?.ownerId === s.id;
                        return (
                          <div key={section} className="grid items-center gap-3 sm:grid-cols-[7rem_1fr_auto]">
                            <label className="text-sm font-medium" htmlFor={`dash-${section}-${s.id}`}>{SECTIONS[section].label}</label>
                            <select className="input" id={`dash-${section}-${s.id}`} name={`dash_${section}`} defaultValue={own ? "own" : (choice?.layoutId ?? "")}>
                              <option value="">The business default</option>
                              {own && <option value="own">Their own</option>}
                              {templates.filter((t) => t.section === section).map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</option>)}
                            </select>
                            <label className="flex items-center gap-2 text-sm" title="They see this dashboard and can't change it">
                              <input type="checkbox" name={`lock_${section}`} defaultChecked={choice?.locked} /> Lock it
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                </ActionForm>
              }
            >
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${s.active ? "" : "opacity-60"}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800" aria-hidden="true">
                  {s.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")}
                </span>
                <div className="min-w-48 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    {s.id === me.id && <span className="text-xs text-gray-500">(you)</span>}
                    {!s.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Inactive</span>}
                  </div>
                  <div className="truncate text-xs text-gray-600">{s.email}</div>
                </div>
                <div className="flex flex-1 flex-wrap gap-1" data-testid="staff-roles">
                  {s.roles.length === 0 ? (
                    <span className="text-xs text-gray-500">No roles</span>
                  ) : (
                    s.roles.map((r) => (
                      <span key={r} className={`rounded-full px-2 py-0.5 text-xs ${r === "ADMIN" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`}>{ROLE_LABELS[r]}</span>
                    ))
                  )}
                </div>
                <div className="w-56 text-xs text-gray-500">{dashboard}</div>
              </div>
            </ListRow>
          );
        })}
        <ListRow
          editLabel="+ Add a staff member"
          testId="add-staff"
          editor={
            <ActionForm action={createStaff} submitLabel="Add staff member" resetOnSuccess>
              <StaffFields />
              <div className="max-w-xs">
                <label className="label" htmlFor="pw-new">Temporary password (min {MIN_PASSWORD_LENGTH} characters)</label>
                <input className="input" id="pw-new" name="password" type="password" autoComplete="new-password" required />
              </div>
            </ActionForm>
          }
        />
      </div>
    </div>
  );
}

function StaffFields({ user }: { user?: StaffUser }) {
  const k = user?.id ?? "new";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`n-${k}`}>Name</label>
          <input className="input" id={`n-${k}`} name="name" defaultValue={user?.name} required />
        </div>
        <div>
          <label className="label" htmlFor={`e-${k}`}>Email</label>
          <input className="input" id={`e-${k}`} name="email" type="email" defaultValue={user?.email} required />
        </div>
      </div>
      <fieldset>
        <legend className="label">Roles</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {ALL_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-1.5">
              <input type="checkbox" name={`role_${r}`} defaultChecked={user?.roles.includes(r)} /> {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
