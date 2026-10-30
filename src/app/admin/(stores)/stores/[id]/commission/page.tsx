import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { loadAdminStore } from "@/lib/store/admin";
import { commissionLabel, commissionSummary } from "@/lib/store/commissions";
import { orderRef } from "@/lib/orders/numbers";
import { recordPayoutAction, removePayoutAction, saveCommissionAction } from "../../actions";

const money = (v: { toFixed(n: number): string }) => {
  const s = v.toFixed(2);
  return s.startsWith("-") ? `−$${s.slice(1)}` : `$${s}`;
};
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** What the store's owner earns on its sales, and what's been paid to them. */
export default async function CommissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, store } = await loadAdminStore((await params).id);
  if (store.kind === "ROOT") notFound();
  const s = await commissionSummary(db, store.id);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4" data-testid="commission-stats">
        <Stat label="Earned (paid orders)" value={money(s.earned)} />
        <Stat label="Pending (not paid yet)" value={money(s.pending)} />
        <Stat label="Paid out" value={money(s.paidOut)} />
        <Stat label={s.owed.isNegative() ? "Paid ahead" : "Owed"} value={money(s.owed.abs())} strong />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">Commission</h2>
          <p className="text-sm text-gray-600">
            Now: <span className="font-medium">{commissionLabel(store)}</span>. Each order keeps the commission worked out when it was placed; it counts as earned once the order is paid in full. Cancelled orders don&apos;t count.
          </p>
          <ActionForm action={saveCommissionAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="storeId" value={store.id} />
            <div>
              <label className="label" htmlFor="commissionKind">Type</label>
              <select className="input w-44" id="commissionKind" name="commissionKind" defaultValue={store.commissionKind ?? ""}>
                <option value="">No commission</option>
                <option value="PERCENT">Percent of sales (%)</option>
                <option value="PER_PIECE">Per piece ($)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="commissionValue">Amount</label>
              <input className="input w-28" id="commissionValue" name="commissionValue" defaultValue={store.commissionValue?.toString() ?? ""} inputMode="decimal" />
            </div>
          </ActionForm>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Payouts</h2>
          <ActionForm action={recordPayoutAction} submitLabel="Record payout" resetOnSuccess className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="storeId" value={store.id} />
            <div>
              <label className="label" htmlFor="amount">Amount</label>
              <input className="input w-28" id="amount" name="amount" inputMode="decimal" placeholder={s.owed.gt(0) ? s.owed.toFixed(2) : "0.00"} required />
            </div>
            <div>
              <label className="label" htmlFor="paidOn">Paid on</label>
              <input className="input" id="paidOn" name="paidOn" type="date" defaultValue={today} required />
            </div>
            <div className="min-w-40 flex-1">
              <label className="label" htmlFor="note">Note</label>
              <input className="input" id="note" name="note" placeholder="Check #1043" />
            </div>
          </ActionForm>
          {s.payouts.length > 0 ? (
            <ul className="divide-y divide-gray-100 text-sm" data-testid="payouts">
              {s.payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>
                    {day(p.paidOn)} · <span className="font-medium">{money(p.amount)}</span>
                    {p.note ? ` · ${p.note}` : ""}
                    <span className="text-xs text-gray-500"> · {p.createdBy?.name ?? "—"}</span>
                  </span>
                  <ActionForm action={removePayoutAction} submitLabel="Remove" danger confirm="Remove this payout?" className="flex">
                    <input type="hidden" name="id" value={p.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No payouts yet.</p>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Orders with commission</h2>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Shopper</th>
                <th className="text-right">Total</th>
                <th className="text-right">Commission</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {s.orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="text-brand-700 hover:underline">{orderRef(o)}</Link></td>
                  <td>{o.placedAt ? day(o.placedAt) : "—"}</td>
                  <td>{o.customer.firstName} {o.customer.lastName}</td>
                  <td className="text-right">{money(o.total)}</td>
                  <td className="text-right font-medium">{money(o.commission)}</td>
                  <td>{o.earned ? <span className="text-green-700">Earned</span> : <span className="text-gray-500">Waiting for payment</span>}</td>
                </tr>
              ))}
              {s.orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500">No orders with commission yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`card ${strong ? "border-brand-300" : ""}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
