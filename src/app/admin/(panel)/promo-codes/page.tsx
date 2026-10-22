import type { PromoCode } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { savePromoAction } from "../storefront/actions";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const KINDS = { PERCENT: "% off items", AMOUNT: "$ off items", FREE_SHIPPING: "Free delivery" } as const;

export default async function PromoCodesPage() {
  const { db } = await requireStaff(["SALES"]);
  const codes = await db.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }], include: { _count: { select: { orders: true } } } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Promo codes</h1>
        <p className="text-sm text-gray-500">One list for the business. Shoppers enter them in the cart; discounts come off before tax.</p>
      </div>
      {codes.map((c) => (
        <div key={c.id} className="card space-y-2" data-testid="promo">
          <ActionForm action={savePromoAction} className="grid gap-3 sm:grid-cols-6 sm:items-end">
            <input type="hidden" name="id" value={c.id} />
            <Fields c={c} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} /> Active</label>
          </ActionForm>
          <p className="text-xs text-gray-500">Used {c.usedCount}{c.maxUses !== null ? ` of ${c.maxUses}` : ""} time{c.usedCount === 1 ? "" : "s"}</p>
        </div>
      ))}
      <div className="card">
        <h2 className="mb-2 font-semibold">New promo code</h2>
        <ActionForm action={savePromoAction} submitLabel="Add code" resetOnSuccess className="grid gap-3 sm:grid-cols-6 sm:items-end">
          <Fields />
        </ActionForm>
      </div>
    </div>
  );
}

function Fields({ c }: { c?: PromoCode }) {
  const k = c?.id ?? "new";
  return (
    <>
      <div>
        <label className="label" htmlFor={`pc-${k}`}>Code</label>
        <input className="input font-mono uppercase" id={`pc-${k}`} name="code" defaultValue={c?.code} required placeholder="SPRING10" />
      </div>
      <div>
        <label className="label" htmlFor={`pk-${k}`}>Gives</label>
        <select className="input" id={`pk-${k}`} name="kind" defaultValue={c?.kind ?? "PERCENT"}>
          {Object.entries(KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`pv-${k}`}>Amount (% or $)</label>
        <input className="input" id={`pv-${k}`} name="value" defaultValue={c?.value.toString() ?? ""} inputMode="decimal" />
      </div>
      <div>
        <label className="label" htmlFor={`pm-${k}`}>Min. items total ($)</label>
        <input className="input" id={`pm-${k}`} name="minSubtotal" defaultValue={c?.minSubtotal?.toString() ?? ""} inputMode="decimal" />
      </div>
      <div>
        <label className="label" htmlFor={`pu-${k}`}>Max uses</label>
        <input className="input" id={`pu-${k}`} name="maxUses" defaultValue={c?.maxUses ?? ""} inputMode="numeric" placeholder="unlimited" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`pd-${k}`}>Description (shown in the cart)</label>
        <input className="input" id={`pd-${k}`} name="description" defaultValue={c?.description ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`ps-${k}`}>Starts</label>
        <input className="input" id={`ps-${k}`} name="startsAt" type="date" defaultValue={day(c?.startsAt ?? null)} />
      </div>
      <div>
        <label className="label" htmlFor={`pe-${k}`}>Ends</label>
        <input className="input" id={`pe-${k}`} name="endsAt" type="date" defaultValue={day(c?.endsAt ?? null)} />
      </div>
    </>
  );
}
