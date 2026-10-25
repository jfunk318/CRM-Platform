import { redirect } from "next/navigation";
import { getShopper } from "@/lib/store/accounts";
import { getRequestStore } from "@/lib/store/resolve";
import { ActionForm } from "@/components/admin/action-form";
import { Honeypot } from "@/components/store/honeypot";
import { passwordSignInAction, sendLinkAction } from "@/app/(store)/actions";

export const metadata = { title: "Store owner sign-in", robots: { index: false } };

/** Sign-in for the owner portal (works whether or not the store is open). */
export default async function OwnerLogin({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const rs = await getRequestStore();
  if (rs && (await getShopper(rs))) redirect("/owner");
  const { expired } = await searchParams;
  return (
    <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Manage {rs?.store.name}</h1>
        {expired && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">That link has expired or was already used. Request a new one below.</p>}
        <p className="text-sm text-gray-600">Enter the email {rs?.business.name} has for you, and we&apos;ll email a link to sign in.</p>
        <ActionForm action={sendLinkAction} submitLabel="Email me a sign-in link" className="space-y-3">
          <Honeypot />
          <input type="hidden" name="next" value="/owner" />
          <div>
            <label className="label" htmlFor="owner-email">Email</label>
            <input className="input" id="owner-email" name="email" type="email" required autoComplete="email" />
          </div>
        </ActionForm>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Or use your password</h2>
        <ActionForm action={passwordSignInAction} submitLabel="Sign in" className="space-y-3">
          <Honeypot />
          <input type="hidden" name="next" value="/owner" />
          <div>
            <label className="label" htmlFor="owner-pw-email">Email</label>
            <input className="input" id="owner-pw-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="owner-pw">Password</label>
            <input className="input" id="owner-pw" name="password" type="password" required autoComplete="current-password" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
