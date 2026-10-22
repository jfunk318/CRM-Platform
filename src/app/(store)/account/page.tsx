import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { orderRef } from "@/lib/orders/numbers";
import { balances } from "@/lib/orders/payments";
import { getShopper } from "@/lib/store/accounts";
import { getRequestStore } from "@/lib/store/resolve";
import { ActionForm } from "@/components/admin/action-form";
import { money } from "@/components/store/items";
import { profileAction, setPasswordAction, signOutAction } from "../actions";

export const metadata = { title: "My account", robots: { index: false } };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function AccountPage() {
  const rs = await getRequestStore();
  if (!rs || rs.settings.accountMode === "GUEST_ONLY") notFound();
  const me = await getShopper(rs);
  if (!me) redirect("/account/login");
  // Orders for this customer record and any other record with the same (verified) email.
  const orders = await rs.db.order.findMany({
    where: { OR: [{ customerId: me.id }, ...(me.email ? [{ customer: { email: { equals: me.email, mode: "insensitive" as const } } }] : [])], publicToken: { not: null } },
    include: { status: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Hi, {me.firstName}</h1>
        <form action={signOutAction}>
          <button className="text-sm text-[var(--accent)] hover:underline">Sign out</button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Orders and quotes</h2>
        {orders.length === 0 ? (
          <p className="text-gray-600">Nothing yet. <Link href="/shop" className="text-[var(--accent)] underline">Start shopping</Link></p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm" data-testid="account-orders">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2">Number</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100">
                    <td className="px-3 py-2"><Link href={`/c/${o.publicToken}`} className="font-medium text-[var(--accent)] hover:underline">{o.type === "QUOTE" ? "Quote " : "Order "}{orderRef(o)}</Link></td>
                    <td className="px-3 py-2">{day(o.placedAt ?? o.createdAt)}</td>
                    <td className="px-3 py-2">{o.status.name}</td>
                    <td className="px-3 py-2 text-right">{money(o.total)}</td>
                    <td className="px-3 py-2 text-right">{o.type === "ORDER" && balances(o).balance.gt(0) ? money(balances(o).balance) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your details</h2>
          <ActionForm action={profileAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="me-first">First name</label>
                <input className="input" id="me-first" name="firstName" defaultValue={me.firstName} required />
              </div>
              <div>
                <label className="label" htmlFor="me-last">Last name</label>
                <input className="input" id="me-last" name="lastName" defaultValue={me.lastName} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="me-phone">Phone</label>
              <input className="input" id="me-phone" name="phone" defaultValue={me.phone ?? ""} />
            </div>
            <p className="text-sm text-gray-500">Email: {me.email}</p>
          </ActionForm>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{me.passwordHash ? "Change password" : "Set a password"}</h2>
          <p className="text-sm text-gray-600">Optional: you can always sign in with an emailed link instead.</p>
          <ActionForm action={setPasswordAction} resetOnSuccess className="space-y-3">
            <div>
              <label className="label" htmlFor="me-pw">New password (at least {MIN_PASSWORD_LENGTH} characters)</label>
              <input className="input" id="me-pw" name="password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="me-pw2">Type it again</label>
              <input className="input" id="me-pw2" name="confirm" type="password" required autoComplete="new-password" />
            </div>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
