import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { orderRef } from "@/lib/orders/numbers";
import { getShopper } from "@/lib/store/accounts";
import { commissionLabel } from "@/lib/store/commissions";
import { personalizationLabel } from "@/lib/store/personalization";
import { PORTAL_SECTIONS, type PortalSection, portalData, portalRole, REQUEST_STATUS_LABELS } from "@/lib/store/portal";
import { getRequestStore } from "@/lib/store/resolve";
import { storeStatus } from "@/lib/store/settings";
import { ActionForm } from "@/components/admin/action-form";
import { money } from "@/components/store/items";
import { ownerSignOutAction, storeRequestAction } from "@/app/(store)/actions";

export const metadata = { title: "Manage your store", robots: { index: false } };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const pct = (v: { toString(): string }) => `${v.toString()}%`;

/** The store owner's view: sales, orders, codes, commission and requests (as the business allows). */
export default async function OwnerPortal({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const rs = await getRequestStore();
  if (!rs || rs.store.kind !== "AFFILIATE") notFound();
  const me = await getShopper(rs);
  if (!me) redirect("/owner/login");
  const role = await portalRole(rs.db, rs.store, me);
  if (!role) {
    return (
      <div className="mx-auto max-w-lg space-y-3 text-center">
        <h1 className="text-2xl font-bold">Store owners only</h1>
        <p className="text-gray-600">You&apos;re signed in as {me.email}, which isn&apos;t set up to manage {rs.store.name}. Ask {rs.business.name} to add you as a contact.</p>
        <form action={ownerSignOutAction}>
          <button className="text-sm text-[var(--accent)] hover:underline">Sign in with another email</button>
        </form>
      </div>
    );
  }
  const sections = (Object.keys(PORTAL_SECTIONS) as PortalSection[]).filter((s) => rs.store.portalSections.includes(s));
  const { tab = sections[0] ?? "contacts" } = await searchParams;
  const data = await portalData(rs.db, rs.store);
  const status = storeStatus(rs.store);

  return (
    <div className="space-y-6" data-testid="owner-portal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Manage {rs.store.name}</h1>
          <p className="text-sm text-gray-600">
            {status.label}
            {rs.store.closesAt ? ` · closes ${day(rs.store.closesAt)}` : ""} · signed in as {me.email}
          </p>
        </div>
        <form action={ownerSignOutAction}>
          <button className="text-sm text-[var(--accent)] hover:underline">Sign out</button>
        </form>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-gray-200 text-sm" aria-label="Owner portal">
        {[...sections, "contacts" as const].map((s) => (
          <Link key={s} href={`/owner?tab=${s}`} className={`rounded-t-md px-3 py-2 ${tab === s ? "border-b-2 border-[var(--accent)] font-medium" : "hover:bg-gray-50"}`}>
            {s === "contacts" ? "Contacts" : PORTAL_SECTIONS[s]}
            {s === "requests" && data.requests?.some((r) => r.reply && r.status !== "NEW") ? " •" : ""}
          </Link>
        ))}
      </nav>

      {tab === "sales" && data.sales && (
        <div className="grid gap-4 sm:grid-cols-3" data-testid="owner-sales">
          <Stat label="Orders" value={String(data.sales.orders)} />
          <Stat label="Pieces sold" value={String(data.sales.pieces)} />
          <Stat label="Sales (after discounts)" value={money(data.sales.sold)} />
        </div>
      )}

      {tab === "orders" && data.orders && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm" data-testid="owner-orders">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2 font-medium">{orderRef(o)}</td>
                  <td className="px-3 py-2">{o.placedAt ? day(o.placedAt) : "—"}</td>
                  <td className="px-3 py-2">{o.customer.firstName} {o.customer.lastName}</td>
                  <td className="px-3 py-2">
                    {o.lines.map((l, i) => (
                      <div key={i}>
                        {l.notes ?? "Item"}: {l.sizes.map((s) => `${s.qty} ${s.size.code}`).join(", ")}
                        {l.names.length > 0 && <span className="text-gray-500"> ({l.names.map(personalizationLabel).join(", ")})</span>}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2">{o.status.name}</td>
                  <td className="px-3 py-2 text-right">{money(o.total)}</td>
                </tr>
              ))}
              {data.orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">No orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "codes" && data.codes && (
        <div className="space-y-4" data-testid="owner-codes">
          <CodeTable
            title="Promo codes"
            rows={data.codes.promos.map((p) => [p.code, p.kind === "PERCENT" ? `${pct(p.value)} off` : p.kind === "AMOUNT" ? `${money(p.value)} off` : "Free shipping", p.endsAt ? `until ${day(p.endsAt)}` : "No end date", String(p.uses), p.saved ? money(p.saved) : "—"])}
            head={["Code", "Discount", "Valid", "Times used", "Saved"]}
          />
          <CodeTable title="Gift codes" rows={data.codes.gifts.map((g) => [g.code, money(g.balance), String(g.uses), g.spent ? money(g.spent) : "—"])} head={["Code", "Balance left", "Times used here", "Spent here"]} />
        </div>
      )}

      {tab === "commission" && data.commission && (
        <div className="space-y-4" data-testid="owner-commission">
          <p className="text-sm text-gray-600">Your commission: {commissionLabel(rs.store)}. It&apos;s earned once an order is paid.</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Earned" value={money(data.commission.earned)} />
            <Stat label="Waiting for payment" value={money(data.commission.pending)} />
            <Stat label="Paid to you" value={money(data.commission.paidOut)} />
            <Stat label="Still to come" value={money(data.commission.owed.isNegative() ? 0 : data.commission.owed)} />
          </div>
          {data.commission.payouts.length > 0 && (
            <ul className="text-sm">
              {data.commission.payouts.map((p) => (
                <li key={p.id}>{day(p.paidOn)} · {money(p.amount)}{p.note ? ` · ${p.note}` : ""}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "requests" && data.requests && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Ask {rs.business.name}</h2>
            <p className="text-sm text-gray-600">New items, a reorder, a change to the store, a question: we&apos;ll answer here and by email.</p>
            <ActionForm action={storeRequestAction} submitLabel="Send request" resetOnSuccess className="space-y-3">
              <div>
                <label className="label" htmlFor="req-subject">Subject</label>
                <input className="input" id="req-subject" name="subject" maxLength={150} required />
              </div>
              <div>
                <label className="label" htmlFor="req-body">Details</label>
                <textarea className="input min-h-28" id="req-body" name="body" maxLength={5000} required />
              </div>
            </ActionForm>
          </section>
          <section className="space-y-2" data-testid="owner-requests">
            <h2 className="text-lg font-semibold">Your requests</h2>
            {data.requests.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
            {data.requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{r.subject}</span>
                  <span className="text-xs text-gray-500">{REQUEST_STATUS_LABELS[r.status]}</span>
                </div>
                <p className="whitespace-pre-wrap text-gray-700">{r.body}</p>
                <p className="text-xs text-gray-500">{r.customer.firstName} {r.customer.lastName} · {day(r.createdAt)}</p>
                {r.reply && <p className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2">{r.reply}</p>}
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "contacts" && (
        <section className="space-y-2" data-testid="owner-contacts">
          <p className="text-sm text-gray-600">People {rs.business.name} has on file for this store. Ask us to add or change anyone.</p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
            {data.contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-medium">{c.customer.firstName} {c.customer.lastName}</span>
                  {c.title ? ` · ${c.title}` : ""}
                </span>
                <span className="text-gray-600">{[c.customer.email, c.customer.phone].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
            {data.contacts.length === 0 && <li className="px-3 py-2 text-gray-500">No contacts yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function CodeTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">None for this store.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{head.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]} className="border-t border-gray-100">{r.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
