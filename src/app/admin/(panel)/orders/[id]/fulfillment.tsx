import Link from "next/link";
import type { DeliveryMethod, Prisma } from "@prisma/client";
import { poRef } from "@/lib/orders/numbers";
import { methodsUsed, methodWork, type jobLinesInclude } from "@/lib/production/jobs";
import type { orderBlankStatus } from "@/lib/purchasing/service";
import { CARRIERS, carrierName, DELIVERY_KIND_LABELS, shipmentProgress, type shippingOrderInclude, trackingUrl } from "@/lib/shipping/service";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { createJobsAction, removeJobAction, stepAction } from "../../production/actions";
import { markSuppliedAction, orderBlanksAction, releaseAllocationAction } from "../../purchasing/actions";
import { createShipmentAction, deleteShipmentAction, notifyPickupAction } from "../../shipping/actions";

/** What the order page loads for these sections. */
export const fulfillmentInclude = {
  deliveryMethod: true,
  shipments: { include: { items: true }, orderBy: { shippedAt: "asc" } },
  productionJobs: { include: { method: true, steps: { orderBy: { sortOrder: "asc" } }, assignedTo: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

type Order = Prisma.OrderGetPayload<{ include: typeof fulfillmentInclude & typeof jobLinesInclude & { customer: true; status: true } }>;

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const when = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

const JOB_STATUS = { QUEUED: "Up next", IN_PROGRESS: "In progress", DONE: "Done" } as const;

export function ProductionSection({ order, canEdit }: { order: Order; canEdit: boolean }) {
  const used = methodsUsed(order.lines);
  const missing = used.filter((m) => !order.productionJobs.some((j) => j.methodId === m));
  const open = !order.status.isClosed;
  return (
    <section className="card space-y-3" data-testid="production-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Production</h2>
        <div className="flex items-center gap-3 text-sm">
          <a href={`/admin/print/work-order/${order.id}`} target="_blank" className="text-brand-700 hover:underline">Work order</a>
          <Link href="/admin/production" className="text-brand-700 hover:underline">Production board</Link>
        </div>
      </div>
      {order.productionJobs.length === 0 && (
        <p className="text-sm text-gray-500">
          No production jobs yet. They&apos;re created when the customer approves a proof{canEdit ? ", or now:" : "."}
        </p>
      )}
      {order.productionJobs.map((j) => {
        const pieces = methodWork(order.lines, j.methodId).pieces;
        const orphan = !used.includes(j.methodId);
        return (
          <div key={j.id} className="rounded-md border border-gray-200 p-3 text-sm" data-testid="order-job">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">{j.method.name}</span> · {pieces} pcs · {JOB_STATUS[j.status]}
                {j.scheduledFor && <> · on {day(j.scheduledFor)}</>}
                {j.assignedTo && <> · {j.assignedTo.name}</>}
              </div>
              {orphan && canEdit && (
                <ActionButton action={removeJobAction} fields={{ jobId: j.id }} label="Remove job" confirm={`Remove the ${j.method.name} job?`} />
              )}
            </div>
            {orphan && <p className="text-xs text-brand-700">This method is no longer on the order.</p>}
            <ol className="mt-2 flex flex-wrap gap-1">
              {j.steps.map((s) =>
                canEdit ? (
                  <li key={s.id}>
                    <ActionButton
                      action={stepAction}
                      fields={{ stepId: s.id, done: s.doneAt ? "0" : "1" }}
                      className={`rounded border px-2 py-0.5 text-xs ${s.doneAt ? "border-green-300 bg-green-50 text-green-800" : "border-gray-200 bg-white text-gray-600"}`}
                      label={<>{s.doneAt ? "✓ " : ""}{s.name}</>}
                    />
                  </li>
                ) : (
                  <li key={s.id} className={`rounded border px-2 py-0.5 text-xs ${s.doneAt ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
                    {s.doneAt ? "✓ " : ""}{s.name}
                  </li>
                ),
              )}
            </ol>
          </div>
        );
      })}
      {canEdit && open && missing.length > 0 && order.lines.length > 0 && (
        <ActionForm action={createJobsAction} submitLabel={order.productionJobs.length ? "Add missing jobs" : "Create production jobs"} className="flex items-center gap-3">
          <input type="hidden" name="orderId" value={order.id} />
        </ActionForm>
      )}
    </section>
  );
}

type BlankStatus = Awaited<ReturnType<typeof orderBlankStatus>>;

export function BlanksSection({ status, canEdit: canPurchase }: { status: BlankStatus; canEdit: boolean }) {
  const canEdit = canPurchase && status.orderOpen;
  const short = status.rows.filter((r) => r.short > 0 && r.variant);
  return (
    <section className="card space-y-3" data-testid="blanks-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Blanks</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${status.ready ? "bg-green-50 text-green-800" : "bg-warn-50 text-warn-900"}`} data-testid="blanks-ready">
          {status.ready ? "All blanks in" : "Waiting on blanks"}
        </span>
      </div>
      {status.rows.length === 0 ? (
        <p className="text-sm text-gray-500">No items yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Need</th>
                <th>Coming from</th>
                <th className="text-right">In hand</th>
              </tr>
            </thead>
            <tbody>
              {status.rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.label}
                    {r.variant && <div className="font-mono text-xs text-gray-500">{r.variant.sku}</div>}
                  </td>
                  <td className="text-right">{r.needed}</td>
                  <td>
                    <ul className="space-y-1">
                      {r.sources.map(({ allocation: a, received }) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2">
                          {a.source === "PO" && a.poLine ? (
                            <span>
                              {a.qty} on <Link href={`/admin/purchasing/${a.poLine.purchaseOrderId}`} className="text-brand-700 hover:underline">{poRef(a.poLine.purchaseOrder.number)}</Link>{" "}
                              ({a.poLine.purchaseOrder.supplier.name}, {a.poLine.purchaseOrder.status.toLowerCase()})
                            </span>
                          ) : a.source === "STOCK" ? (
                            <span>{a.qty} from stock</span>
                          ) : (
                            <span>{a.qty} supplied{a.note ? `: ${a.note}` : ""}</span>
                          )}
                          {canEdit && (a.source !== "PO" || a.poLine?.purchaseOrder.status === "DRAFT") && (
                            <ActionButton action={releaseAllocationAction} fields={{ allocationId: a.id }} label="Release" className="text-xs text-red-700 hover:underline" />
                          )}
                          {a.source === "PO" && <span className="text-xs text-gray-500">{received} received</span>}
                        </li>
                      ))}
                      {r.short > 0 && <li className="text-brand-700">{r.short} still to order</li>}
                      {r.covered > r.needed && <li className="text-xs text-brand-700">{r.covered - r.needed} more than needed</li>}
                      {!r.variant && <li className="text-xs text-red-700">No SKU in the catalog for this size</li>}
                    </ul>
                  </td>
                  <td className="text-right">{r.inHand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && short.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionForm action={orderBlanksAction} submitLabel="Order these" className="space-y-2 rounded-md border border-dashed border-gray-300 p-3 text-sm">
            <div className="font-medium">Order from suppliers</div>
            {short.map((r) => (
              <label key={r.key} className="flex items-center gap-2">
                <input type="checkbox" name="key" value={r.key} defaultChecked /> {r.short} × {r.label}
                {r.variant?.stockOnHand ? <span className="text-xs text-gray-500">({r.variant.stockOnHand} in stock)</span> : null}
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="checkbox" name="useStock" defaultChecked /> Use in-house stock first
            </label>
            <p className="text-xs text-gray-500">Goes onto the supplier&apos;s draft purchase order, together with other orders&apos; blanks.</p>
          </ActionForm>
          <ActionForm action={markSuppliedAction} submitLabel="Mark supplied" resetOnSuccess className="space-y-2 rounded-md border border-dashed border-gray-300 p-3 text-sm">
            <div className="font-medium">Customer-supplied or already here</div>
            <select className="input" name="key" aria-label="Item">
              {short.map((r) => <option key={r.key} value={r.key}>{r.short} × {r.label}</option>)}
            </select>
            <input className="input" name="note" placeholder="e.g. Customer dropping off Monday" aria-label="Note" />
          </ActionForm>
        </div>
      )}
    </section>
  );
}

export function ShippingSection({
  order,
  methods,
  canEdit,
}: {
  order: Order & Prisma.OrderGetPayload<{ include: typeof shippingOrderInclude }>;
  methods: DeliveryMethod[];
  canEdit: boolean;
}) {
  const progress = shipmentProgress(order);
  const method = order.deliveryMethod;
  const pickup = method?.kind === "PICKUP";
  return (
    <section className="card space-y-3" data-testid="shipping-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Shipping</h2>
        <a href={`/admin/print/packing-slips?ids=${order.id}`} target="_blank" className="text-sm text-brand-700 hover:underline">Packing slip</a>
      </div>
      <p className="text-sm">
        {method ? <>{method.name} <span className="text-gray-500">({DELIVERY_KIND_LABELS[method.kind]})</span></> : <span className="text-gray-500">No delivery method set (see Details)</span>}
        {" · "}
        {progress.complete ? (
          <span className="text-green-700">Everything has gone out</span>
        ) : (
          <span>{progress.remaining} of {progress.total} pieces to go</span>
        )}
      </p>

      {order.shipments.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm" data-testid="shipments">
          {order.shipments.map((sh) => {
            const url = trackingUrl(sh.carrier, sh.trackingNumber);
            const pieces = sh.items.reduce((n, i) => n + i.qty, 0);
            return (
              <li key={sh.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div>
                  <div>
                    {when(sh.shippedAt)} · {sh.kind === "SHIP" ? `Shipped${sh.carrier ? ` ${carrierName(sh.carrier)}` : ""}` : DELIVERY_KIND_LABELS[sh.kind]} · {pieces} pcs
                    {sh.methodName && <span className="text-gray-500"> · {sh.methodName}</span>}
                  </div>
                  {sh.trackingNumber && (
                    <div className="font-mono text-xs">
                      {url ? <a href={url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{sh.trackingNumber}</a> : sh.trackingNumber}
                    </div>
                  )}
                  {sh.note && <div className="text-xs text-gray-600">{sh.note}</div>}
                  <div className="text-xs text-gray-500">{sh.items.map((i) => `${i.qty} × ${i.description}`).join(", ")}</div>
                  {sh.notifiedAt && <div className="text-xs text-gray-500">Customer notified</div>}
                </div>
                {canEdit && <ActionButton action={deleteShipmentAction} fields={{ shipmentId: sh.id }} label="Remove" confirm="Remove this shipment record?" className="text-xs text-red-700 hover:underline" />}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && !progress.complete && progress.total > 0 && (
        <>
          {(pickup || !method) && (
            <ActionForm action={notifyPickupAction} submitLabel="Email: ready for pickup" className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="orderId" value={order.id} />
              {order.readyNotifiedAt && <span className="text-xs text-gray-500">Last sent {when(order.readyNotifiedAt)}</span>}
            </ActionForm>
          )}
          <details className="rounded-md border border-dashed border-gray-300 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">+ Record a shipment or pickup</summary>
            <ActionForm action={createShipmentAction} submitLabel="Record" className="mt-3 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="sh-method">Delivery method</label>
                  <select className="input" id="sh-method" name="deliveryMethodId" defaultValue={method?.id ?? ""}>
                    <option value="">Other (choose below)</option>
                    {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sh-kind">Going out by (if &quot;Other&quot;)</label>
                  <select className="input" id="sh-kind" name="kind" defaultValue="SHIP">
                    {Object.entries(DELIVERY_KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sh-carrier">Carrier</label>
                  <select className="input" id="sh-carrier" name="carrier" defaultValue={method?.carrier && CARRIERS[method.carrier] ? method.carrier : ""}>
                    <option value="">—</option>
                    {Object.entries(CARRIERS).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sh-tracking">Tracking number</label>
                  <input className="input font-mono" id="sh-tracking" name="trackingNumber" />
                </div>
                <div>
                  <label className="label" htmlFor="sh-cost">Postage cost ($, staff only)</label>
                  <input className="input" id="sh-cost" name="cost" inputMode="decimal" />
                </div>
                <div>
                  <label className="label" htmlFor="sh-note">Note</label>
                  <input className="input" id="sh-note" name="note" placeholder="e.g. picked up by Pat" />
                </div>
              </div>
              <fieldset>
                <legend className="label">What&apos;s going</legend>
                <table className="text-sm">
                  <tbody>
                    {progress.rows.filter((r) => r.remaining > 0).map((r) => (
                      <tr key={`${r.lineId}:${r.sizeId}`}>
                        <td className="py-0.5 pr-3">
                          <label htmlFor={`ship-${r.lineId}-${r.sizeId}`}>{r.description}</label>
                        </td>
                        <td className="py-0.5">
                          <input className="input w-20" id={`ship-${r.lineId}-${r.sizeId}`} name={`ship_${r.lineId}:${r.sizeId}`} defaultValue={r.remaining} inputMode="numeric" />
                        </td>
                        <td className="py-0.5 pl-2 text-xs text-gray-500">of {r.remaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notify" defaultChecked /> Email {order.customer.email ?? "the customer"} (with tracking)
              </label>
            </ActionForm>
          </details>
        </>
      )}
    </section>
  );
}
