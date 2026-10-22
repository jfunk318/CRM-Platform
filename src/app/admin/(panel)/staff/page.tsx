import type { StaffUser } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { ActionForm } from "@/components/admin/action-form";
import { createStaff, saveStaff } from "./actions";

export default async function StaffPage() {
  const me = await requireStaff(["ADMIN"]);
  const staff = await db.staffUser.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Staff</h1>
        <p className="text-sm text-gray-500">
          Roles control which parts of the back office each person can use. Admins can do everything.
        </p>
      </div>
      {staff.map((s) => (
        <div key={s.id} className={`card ${s.active ? "" : "opacity-60"}`}>
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
          </ActionForm>
        </div>
      ))}
      <div className="card">
        <h2 className="mb-2 font-semibold">Add staff</h2>
        <ActionForm action={createStaff} submitLabel="Add staff member" resetOnSuccess>
          <StaffFields />
          <div className="max-w-xs">
            <label className="label" htmlFor="pw-new">Temporary password (min {MIN_PASSWORD_LENGTH} characters)</label>
            <input className="input" id="pw-new" name="password" type="password" autoComplete="new-password" required />
          </div>
        </ActionForm>
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
