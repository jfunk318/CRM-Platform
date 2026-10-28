import { notFound, redirect } from "next/navigation";
import { getShopper } from "@/lib/store/accounts";
import { getRequestStore } from "@/lib/store/resolve";
import { ActionForm } from "@/components/admin/action-form";
import { Honeypot } from "@/components/store/honeypot";
import { passwordSignInAction, sendLinkAction } from "../../actions";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const rs = await getRequestStore();
  if (!rs || rs.settings.accountMode === "GUEST_ONLY") notFound();
  const { next = "/account", expired } = await searchParams;
  if (await getShopper(rs)) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
  return (
    <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Sign in or create an account</h1>
        {expired && <p className="rounded-md bg-[var(--st-subtle)] px-3 py-2 text-sm text-[var(--st-text)]">That link has expired or was already used. Request a new one below.</p>}
        <p className="text-sm text-[var(--st-muted)]">We&apos;ll email you a link to sign in. No password needed; new here? The same link creates your account.</p>
        <ActionForm action={sendLinkAction} submitLabel="Email me a sign-in link" className="space-y-3">
          <Honeypot />
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="link-email">Email</label>
            <input className="input" id="link-email" name="email" type="email" required autoComplete="email" />
          </div>
        </ActionForm>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Or use your password</h2>
        <ActionForm action={passwordSignInAction} submitLabel="Sign in" className="space-y-3">
          <Honeypot />
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="pw-email">Email</label>
            <input className="input" id="pw-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="pw-password">Password</label>
            <input className="input" id="pw-password" name="password" type="password" required autoComplete="current-password" />
          </div>
        </ActionForm>
        <p className="text-xs text-[var(--st-muted)]">Forgot it? Use the emailed link, then set a new password on your account page.</p>
      </section>
    </div>
  );
}
