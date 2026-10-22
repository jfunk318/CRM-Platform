import type { DeliveryMethod } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { CARRIERS, DELIVERY_KIND_LABELS } from "@/lib/shipping/service";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { deleteDeliveryMethod, saveDeliveryMethod } from "../shipping/actions";

export default async function DeliveryMethodsPage() {
  const { db } = await requireStaff(["ADMIN"]);
  const methods = await db.deliveryMethod.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: { _count: { select: { orders: true } } },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Delivery methods</h1>
        <p className="text-sm text-gray-500">
          One list for the whole business: chosen on orders now, and offered by your storefront and affiliate stores later.
          Carrier and service codes are for the ShipStation connection (integrations phase).
        </p>
      </div>
      {methods.map((m) => (
        <div key={m.id} className="card space-y-2" data-testid="delivery-method">
          <ActionForm action={saveDeliveryMethod} className="grid gap-3 sm:grid-cols-6 sm:items-end">
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="sortOrder" value={m.sortOrder} />
            <Fields m={m} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={m.active} /> Active
            </label>
          </ActionForm>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            Used on {m._count.orders} order{m._count.orders === 1 ? "" : "s"}
            <ActionButton action={deleteDeliveryMethod} fields={{ id: m.id }} label="Delete" className="text-red-700 hover:underline" confirm={`Delete ${m.name}? Orders using it keep their shipping amount.`} />
          </div>
        </div>
      ))}
      <div className="card">
        <h2 className="mb-2 font-semibold">Add a delivery method</h2>
        <ActionForm action={saveDeliveryMethod} submitLabel="Add" resetOnSuccess className="grid gap-3 sm:grid-cols-6 sm:items-end">
          <Fields />
        </ActionForm>
      </div>
    </div>
  );
}

function Fields({ m }: { m?: DeliveryMethod }) {
  const k = m?.id ?? "new";
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`dn-${k}`}>Name</label>
        <input className="input" id={`dn-${k}`} name="name" defaultValue={m?.name} required placeholder="e.g. UPS Ground" />
      </div>
      <div>
        <label className="label" htmlFor={`dk-${k}`}>Type</label>
        <select className="input" id={`dk-${k}`} name="kind" defaultValue={m?.kind ?? "SHIP"}>
          {Object.entries(DELIVERY_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`dp-${k}`}>Charge ($)</label>
        <input className="input" id={`dp-${k}`} name="price" defaultValue={m ? m.price.toFixed(2) : ""} inputMode="decimal" placeholder="0.00" />
      </div>
      <div>
        <label className="label" htmlFor={`df-${k}`}>Free over ($)</label>
        <input className="input" id={`df-${k}`} name="freeOver" defaultValue={m?.freeOver?.toFixed(2) ?? ""} inputMode="decimal" placeholder="never" />
      </div>
      <div>
        <label className="label" htmlFor={`dc-${k}`}>Carrier</label>
        <select className="input" id={`dc-${k}`} name="carrier" defaultValue={m?.carrier ?? ""}>
          <option value="">—</option>
          {Object.entries(CARRIERS).map(([v, c]) => <option key={v} value={v}>{c.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="label" htmlFor={`dd-${k}`}>Description (shown to customers)</label>
        <input className="input" id={`dd-${k}`} name="description" defaultValue={m?.description ?? ""} placeholder="e.g. 3–5 business days after production" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`ds-${k}`}>Service code</label>
        <input className="input font-mono" id={`ds-${k}`} name="service" defaultValue={m?.service ?? ""} placeholder="e.g. ups_ground" />
      </div>
    </>
  );
}
