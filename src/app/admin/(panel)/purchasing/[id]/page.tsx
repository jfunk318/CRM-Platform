import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { orderRef, poRef } from "@/lib/orders/numbers";
import { PO_STATUS } from "@/lib/purchasing/labels";
import { purchaseOrderInclude, shipToLines, variantLabel } from "@/lib/purchasing/service";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import {
  addPoItemAction,
  cancelPoAction,
  receivePoAction,
  removePoLineAction,
  sendPoAction,
  updatePoAction,
  updatePoLineAction,
} from "../actions";

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;
const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireStaff(["PURCHASING"]);
  const { id } = await params;
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { ...purchaseOrderInclude, createdBy: { select: { name: true } }, emails: { orderBy: { createdAt: "desc" } } },
  });
  if (!po) notFound();
  const draft = po.status === "DRAFT";
  const receiving = po.status === "SENT" || po.status === "PARTIAL" || po.status === "RECEIVED";
  const pieces = po.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/purchasing" className="text-sm text-amber-700 hover:underline">← Purchasing</Link>
          <h1 className="page-title mt-1 flex items-center gap-3">
            {poRef(po.number)}
            <span className={`rounded-full px-2 py-0.5 text-xs font-normal ${PO_STATUS[po.status].className}`} data-testid="po-status">{PO_STATUS[po.status].label}</span>
          </h1>
          <p className="text-sm text-gray-600">
            {po.supplier.name}
            {po.supplier.accountNumber && <> · account {po.supplier.accountNumber}</>}
            {po.supplier.email ? <> · {po.supplier.email}</> : <> · <Link href="/admin/suppliers" className="text-amber-700 hover:underline">add an email for this supplier</Link></>}
            {po.supplier.phone && <> · {po.supplier.phone}</>}
          </p>
          <p className="text-xs text-gray-500">
            Created {when(po.createdAt)}{po.createdBy ? ` by ${po.createdBy.name}` : ""}
            {po.sentAt && ` · sent ${when(po.sentAt)}`}
            {po.receivedAt && ` · received ${when(po.receivedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/admin/print/purchase-order/${po.id}`} target="_blank" className="btn-secondary">Print / PDF</a>
          {po.status !== "CANCELLED" && po.status !== "RECEIVED" && po.lines.every((l) => l.qtyReceived === 0) && (
            <ActionForm
              action={cancelPoAction}
              submitLabel={draft ? "Delete draft" : "Cancel PO"}
              danger
              confirm={draft ? "Delete this draft? Its orders will need their blanks ordered again." : "Cancel this purchase order? Let the supplier know too."}
              className="flex items-center gap-2"
            >
              <input type="hidden" name="poId" value={po.id} />
            </ActionForm>
          )}
        </div>
      </div>

      {(draft || po.status === "SENT") && po.lines.length > 0 && (
        <ActionForm action={sendPoAction} submitLabel={draft ? "Send purchase order" : "Email it again"} className="card flex flex-wrap items-center gap-4" >
          <input type="hidden" name="poId" value={po.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="email" defaultChecked={!!po.supplier.email} disabled={!po.supplier.email} /> Email it to {po.supplier.email ?? "the supplier (no email on file)"}
          </label>
          {draft && <span className="text-xs text-gray-500">Unticked: just marks it sent, e.g. after ordering on the supplier&apos;s website.</span>}
        </ActionForm>
      )}

      <section className="card overflow-x-auto p-0">
        <table className="table" data-testid="po-lines">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Line</th>
              <th className="text-right">Received</th>
              <th>For</th>
              {draft && <th></th>}
            </tr>
          </thead>
          <tbody>
            {po.lines.length === 0 && (
              <tr>
                <td colSpan={8} className="text-gray-500">No items yet.</td>
              </tr>
            )}
            {po.lines.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.variant.supplierSku ?? l.variant.sku}</td>
                <td>{variantLabel(l.variant)}</td>
                {draft ? (
                  <td colSpan={2}>
                    <ActionForm action={updatePoLineAction} submitLabel="Save" className="flex items-center justify-end gap-1">
                      <input type="hidden" name="poId" value={po.id} />
                      <input type="hidden" name="lineId" value={l.id} />
                      <input className="input w-16 text-right" name="qty" defaultValue={l.qty} aria-label="Quantity" inputMode="numeric" />
                      <input className="input w-20 text-right" name="unitCost" defaultValue={l.unitCost.toFixed(2)} aria-label="Cost" inputMode="decimal" />
                    </ActionForm>
                  </td>
                ) : (
                  <>
                    <td className="text-right">{l.qty}</td>
                    <td className="text-right">{money(l.unitCost)}</td>
                  </>
                )}
                <td className="text-right">{money(l.unitCost.times(l.qty))}</td>
                <td className={`text-right ${l.qtyReceived >= l.qty ? "text-green-700" : l.qtyReceived > 0 ? "text-amber-700" : ""}`}>{l.qtyReceived}</td>
                <td className="text-xs">
                  {l.allocations.length === 0
                    ? "Stock"
                    : l.allocations.map((a) => (
                        <div key={a.id}>
                          <Link href={`/admin/orders/${a.orderId}`} className="text-amber-700 hover:underline">{orderRef(a.order)}</Link> × {a.qty}
                        </div>
                      ))}
                  {l.qty > l.allocations.reduce((n, a) => n + a.qty, 0) && l.allocations.length > 0 && (
                    <div className="text-gray-500">+ {l.qty - l.allocations.reduce((n, a) => n + a.qty, 0)} for stock</div>
                  )}
                </td>
                {draft && (
                  <td>
                    <ActionButton action={removePoLineAction} fields={{ poId: po.id, lineId: l.id }} label="Remove" className="text-xs text-red-700 hover:underline" confirm="Remove this item? Orders waiting on it will need it ordered again." />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={2}>Total</td>
              <td className="text-right">{pieces}</td>
              <td></td>
              <td className="text-right" data-testid="po-total">{money(po.total)}</td>
              <td colSpan={draft ? 3 : 2}></td>
            </tr>
          </tfoot>
        </table>
      </section>

      {draft && (
        <ActionForm action={addPoItemAction} submitLabel="Add item" resetOnSuccess className="card flex flex-wrap items-end gap-3">
          <input type="hidden" name="poId" value={po.id} />
          <div>
            <label className="label" htmlFor="sku">Add for stock: SKU</label>
            <input className="input font-mono" id="sku" name="sku" required />
          </div>
          <div>
            <label className="label" htmlFor="qty">Qty</label>
            <input className="input w-24" id="qty" name="qty" required inputMode="numeric" />
          </div>
        </ActionForm>
      )}

      {receiving && (
        <section className="card space-y-3" data-testid="receive">
          <h2 className="font-semibold">Receive</h2>
          <p className="text-sm text-gray-500">Count what arrived. Anything beyond what orders need goes into stock. Enter a negative number to correct a mistake.</p>
          <ActionForm action={receivePoAction} submitLabel="Record received" className="space-y-3">
            <input type="hidden" name="poId" value={po.id} />
            <table className="text-sm">
              <tbody>
                {po.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-0.5 pr-3">
                      <label htmlFor={`recv-${l.id}`}>{variantLabel(l.variant)}</label>
                    </td>
                    <td className="py-0.5">
                      <input className="input w-20" id={`recv-${l.id}`} name={`recv_${l.id}`} defaultValue={Math.max(0, l.qty - l.qtyReceived) || ""} inputMode="numeric" />
                    </td>
                    <td className="py-0.5 pl-2 text-xs text-gray-500">{l.qtyReceived} of {l.qty} in</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ActionForm>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Details</h2>
        <fieldset disabled={po.status === "CANCELLED"}>
          <ActionForm action={updatePoAction}>
            <input type="hidden" name="poId" value={po.id} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Ship to" name="shipToName" value={po.shipToName} />
              <Field label="Street" name="shipLine1" value={po.shipLine1} />
              <Field label="Apt / suite" name="shipLine2" value={po.shipLine2} />
              <Field label="City" name="shipCity" value={po.shipCity} />
              <Field label="State" name="shipRegion" value={po.shipRegion} />
              <Field label="ZIP" name="shipPostalCode" value={po.shipPostalCode} />
              <Field label="Country" name="shipCountry" value={po.shipCountry} />
              <Field label="Expected" name="expectedAt" type="date" value={po.expectedAt?.toISOString().slice(0, 10) ?? null} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="blindShip" defaultChecked={po.blindShip} /> Ship blind (no supplier paperwork or branding; for shipping straight to a customer)
            </label>
            <div>
              <label className="label" htmlFor="notes">Notes on the PO</label>
              <textarea className="input min-h-14" id="notes" name="notes" defaultValue={po.notes ?? ""} />
            </div>
          </ActionForm>
        </fieldset>
        <p className="mt-2 text-xs text-gray-500">Printed and emailed ship-to: {shipToLines(po).join(", ") || "none"}</p>
      </section>

      {po.emails.length > 0 && (
        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">Emails</h2>
          <ul className="space-y-1">
            {po.emails.map((e) => (
              <li key={e.id}>
                {e.subject} · to {e.to} · {when(e.createdAt)} · {e.status === "SENT" ? "sent" : e.status === "LOGGED" ? "not sent (email not set up)" : `failed: ${e.error}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({ label, name, value, type }: { label: string; name: string; value: string | null; type?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={type} defaultValue={value ?? ""} />
    </div>
  );
}
