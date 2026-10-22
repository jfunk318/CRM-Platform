import { requireStaff } from "@/lib/auth/session";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { ActionForm } from "@/components/admin/action-form";
import { changeMyPassword } from "../staff/actions";

export default async function AccountPage() {
  const me = await requireStaff();
  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="page-title">My account</h1>
        <p className="text-sm text-gray-500">
          {me.name} · {me.email} · {me.roles.map((r) => ROLE_LABELS[r]).join(", ")}
        </p>
      </div>
      <div className="card">
        <h2 className="mb-2 font-semibold">Change password</h2>
        <ActionForm action={changeMyPassword} submitLabel="Change password" resetOnSuccess>
          <div>
            <label className="label" htmlFor="current">Current password</label>
            <input className="input" id="current" name="current" type="password" autoComplete="current-password" required />
          </div>
          <div>
            <label className="label" htmlFor="next">New password (min {MIN_PASSWORD_LENGTH} characters)</label>
            <input className="input" id="next" name="next" type="password" autoComplete="new-password" required />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm new password</label>
            <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
