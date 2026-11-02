import type { DeliveryMethod } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { CARRIERS, DELIVERY_KIND_LABELS } from "@/lib/shipping/service";
import { ActionForm } from "@/components/admin/action-form";
import { ListRow } from "@/components/admin/list-row";
import { ToggleAction } from "@/components/admin/toggle-action";
import { deleteDeliveryMethod, saveDeliveryMethod, setDeliveryActiveAction } from "../shipping/actions";

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
          One list for the whole business: chosen on orders and offered at checkout in your stores (each store can offer only some).
          Untick Offered to stop using one without deleting it.
        </p>
      </div>
      <div className="card divide-y divide-gray-100 p-0" data-testid="delivery-methods">
        {methods.map((m) => (
          <ListRow
            key={m.id}
            testId="delivery-method"
            editor={
              <ActionForm action={saveDeliveryMethod} className="grid gap-3 sm:grid-cols-6 sm:items-end">
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="sortOrder" value={m.sortOrder} />
                <input type="hidden" name="active" value={m.active ? "on" : ""} />
                <Fields m={m} />
              </ActionForm>
            }
            remove={{ action: deleteDeliveryMethod, fields: { id: m.id }, label: "Delete", confirm: `Delete ${m.name}? Orders using it keep their shipping amount.` }}
          >
            <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${m.active ? "" : "opacity-60"}`}>
              <div className="min-w-48 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{DELIVERY_KIND_LABELS[m.kind]}</span>
                  {m.carrier && <span className="text-xs text-gray-500">{CARRIERS[m.carrier]?.name ?? m.carrier}{m.service && <> · <span className="font-mono">{m.service}</span></>}</span>}
                </div>
                {m.description && <div className="truncate text-xs text-gray-600">{m.description}</div>}
              </div>
              <div className="w-36 text-right tabular-nums">
                <div className="font-medium">{m.price.isZero() ? "Free" : `$${m.price.toFixed(2)}`}</div>
                {m.freeOver && <div className="text-xs text-gray-500">free over ${m.freeOver.toFixed(2)}</div>}
              </div>
              <div className="w-28 text-xs text-gray-500">{m._count.orders} order{m._count.orders === 1 ? "" : "s"}</div>
              <ToggleAction action={setDeliveryActiveAction} fields={{ id: m.id }} name="active" checked={m.active} label="Offered" />
            </div>
          </ListRow>
        ))}
        <ListRow editLabel="+ Add a delivery method" testId="add-delivery-method"
          editor={
            <ActionForm action={saveDeliveryMethod} submitLabel="Add" resetOnSuccess className="grid gap-3 sm:grid-cols-6 sm:items-end">
              <Fields />
            </ActionForm>
          }
        />
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
