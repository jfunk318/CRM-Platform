import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { orderRef } from "@/lib/orders/numbers";
import { ActionForm } from "@/components/admin/action-form";
import { StoreScope } from "@/components/admin/store-scope";
import { saveGiftAction } from "../actions";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;

export default async function GiftCodesPage() {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  const [codes, stores] = await Promise.all([
    db.giftCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }], include: { stores: true, uses: { include: { order: { include: { store: true } } }, orderBy: { createdAt: "desc" } } } }),
    db.store.findMany({ orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true, kind: true } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Gift codes</h1>
        <p className="text-sm text-gray-500">Codes with a balance that shoppers spend at checkout, like a gift card. Each works in all stores or only the ones you choose.</p>
      </div>
      <div className="card">
        <h2 className="mb-2 font-semibold">New gift code</h2>
        <ActionForm action={saveGiftAction} submitLabel="Create" resetOnSuccess className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <StoreScope k="new" allStores chosen={[]} stores={stores} />
          <div>
            <label className="label" htmlFor="g-amount">Amount ($)</label>
            <input className="input" id="g-amount" name="amount" required inputMode="decimal" />
          </div>
          <div>
            <label className="label" htmlFor="g-code">Code (blank = random)</label>
            <input className="input font-mono uppercase" id="g-code" name="code" />
          </div>
          <div>
            <label className="label" htmlFor="g-exp">Expires (optional)</label>
            <input className="input" id="g-exp" name="expiresAt" type="date" />
          </div>
          <div>
            <label className="label" htmlFor="g-note">For (note)</label>
            <input className="input" id="g-note" name="note" placeholder="e.g. raffle prize" />
          </div>
        </ActionForm>
      </div>
      {codes.map((g) => (
        <div key={g.id} className="card space-y-2" data-testid="gift">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-semibold">{g.code}</span>
            <span className="text-sm text-gray-600">{money(g.balance)} left of {money(g.initialAmount)}</span>
          </div>
          <ActionForm action={saveGiftAction} className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <input type="hidden" name="id" value={g.id} />
            <div>
              <label className="label" htmlFor={`gb-${g.id}`}>Balance ($)</label>
              <input className="input" id={`gb-${g.id}`} name="balance" defaultValue={g.balance.toFixed(2)} inputMode="decimal" />
            </div>
            <div>
              <label className="label" htmlFor={`ge-${g.id}`}>Expires</label>
              <input className="input" id={`ge-${g.id}`} name="expiresAt" type="date" defaultValue={day(g.expiresAt)} />
            </div>
            <div>
              <label className="label" htmlFor={`gn-${g.id}`}>Note</label>
              <input className="input" id={`gn-${g.id}`} name="note" defaultValue={g.note ?? ""} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={g.active} /> Active</label>
            <StoreScope k={g.code} allStores={g.allStores} chosen={g.stores.map((s) => s.storeId)} stores={stores} />
          </ActionForm>
          {g.uses.length > 0 && (
            <p className="text-xs text-gray-500">
              Used on{" "}
              {g.uses.map((u, i) => (
                <span key={u.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/orders/${u.orderId}`} className="text-amber-700 hover:underline">{orderRef(u.order)}</Link> ({money(u.amount)}{u.order.store ? `, ${u.order.store.name}` : ""})
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
