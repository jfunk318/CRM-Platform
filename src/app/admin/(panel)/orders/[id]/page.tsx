import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { orderRef } from "@/lib/orders/numbers";
import type { Fee, PricingIssue } from "@/lib/pricing";
import { ActionForm } from "@/components/admin/action-form";
import { LineEditor, type LineValue } from "@/components/admin/line-editor";
import { StatusBadge } from "@/components/admin/order-table";
import {
  addLineAction,
  addNoteAction,
  assignAction,
  convertQuoteAction,
  removeLineAction,
  saveDetailsAction,
  setStatusAction,
  updateLineAction,
} from "../actions";

const money = (v: { toFixed(n: number): string } | string) => `$${typeof v === "string" ? Number(v).toFixed(2) : v.toFixed(2)}`;
const when = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { db } = staff;
  const canEdit = hasAnyRole(staff.roles, ["SALES"]);
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: { include: { company: true } },
      status: true,
      assignedTo: true,
      quote: true,
      convertedTo: true,
      pricingGroup: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          sizes: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } },
          design: {
            include: {
              product: true,
              color: true,
              decorations: { orderBy: { sortOrder: "asc" }, include: { method: true } },
            },
          },
        },
      },
      events: { orderBy: { createdAt: "desc" }, include: { staff: { select: { name: true } } } },
    },
  });
  if (!order) notFound();

  const [statuses, staffList, products, groups] = await Promise.all([
    db.orderStatus.findMany({ where: { type: order.type }, orderBy: { sortOrder: "asc" } }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    canEdit
      ? db.product.findMany({ where: { status: { not: "DISCONTINUED" }, variants: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true, styleCode: true } })
      : [],
    db.pricingGroup.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);

  const isQuote = order.type === "QUOTE";
  const problemLines = order.lines.filter((l) =>
    (l.issues as unknown as PricingIssue[]).some((i) => i.severity === "error"),
  ).length;
  const locked = isQuote && Boolean(order.convertedTo);
  const editable = canEdit && !locked;
  const lineValue = (line: (typeof order.lines)[number]): LineValue => ({
    productId: line.design.productId,
    colorId: line.design.colorId,
    quantities: Object.fromEntries(line.sizes.map((s) => [s.sizeId, String(s.qty)])),
    notes: line.notes ?? "",
    decorations: line.design.decorations.map((d) => ({
      methodId: d.methodId,
      areaId: d.areaId ?? "",
      location: d.location,
      colors: d.colors?.toString() ?? "",
      stitches: d.stitches?.toString() ?? "",
      widthIn: d.widthIn?.toString() ?? "",
      heightIn: d.heightIn?.toString() ?? "",
      inkColors: d.inkColors.join(", "),
      needsArtwork: d.needsArtwork,
      needsDigitizing: d.needsDigitizing,
      reuseScreens: d.reuseScreens,
    })),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/admin/orders?type=${order.type}`} className="text-sm text-amber-700 hover:underline">
            ← {isQuote ? "Quotes" : "Orders"}
          </Link>
          <h1 className="page-title mt-1 flex items-center gap-3">
            {isQuote ? "Quote" : "Order"} {orderRef(order)} <StatusBadge status={order.status} />
          </h1>
          {order.title && <p className="text-gray-700">{order.title}</p>}
          <p className="text-sm text-gray-600">
            <Link href={`/admin/customers/${order.customerId}`} className="text-amber-700 hover:underline">
              {order.customer.firstName} {order.customer.lastName}
            </Link>
            {order.customer.company && <> · {order.customer.company.name}</>}
            {order.customer.email && <> · {order.customer.email}</>}
            {order.customer.phone && <> · {order.customer.phone}</>}
          </p>
          {order.quote && (
            <p className="text-sm text-gray-500">
              From quote <Link href={`/admin/orders/${order.quote.id}`} className="text-amber-700 hover:underline">{orderRef(order.quote)}</Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ActionForm action={setStatusAction} submitLabel="Set" className="flex items-end gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="label" htmlFor="statusId">Status</label>
              <select className="input" id="statusId" name="statusId" defaultValue={order.statusId}>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </ActionForm>
          <ActionForm action={assignAction} submitLabel="Assign" className="flex items-end gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="label" htmlFor="assignedToId">Assigned to</label>
              <select className="input" id="assignedToId" name="assignedToId" defaultValue={order.assignedToId ?? ""}>
                <option value="">Nobody</option>
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </ActionForm>
        </div>
      </div>

      {locked && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          This quote became order{" "}
          <Link href={`/admin/orders/${order.convertedTo!.id}`} className="font-medium underline">{orderRef(order.convertedTo!)}</Link>.
          Make changes on the order.
        </div>
      )}
      {problemLines > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {problemLines} item{problemLines === 1 ? " has" : "s have"} pricing problems, so the total isn&apos;t complete. See the
          notes on each item below.
        </div>
      )}
      {isQuote && !locked && canEdit && order.lines.length > 0 && (
        <ActionForm action={convertQuoteAction} submitLabel="Convert to order" confirm="Create an order from this quote?" className="flex items-center gap-3">
          <input type="hidden" name="orderId" value={order.id} />
        </ActionForm>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-semibold">Items</h2>
            {order.lines.length === 0 && <p className="text-sm text-gray-500">No items yet.</p>}
            {order.lines.map((line) => {
              const fees = line.fees as unknown as (Omit<Fee, "amount"> & { amount: string })[];
              const issues = line.issues as unknown as PricingIssue[];
              const qty = line.sizes.reduce((n, s) => n + s.qty, 0);
              return (
                <div key={line.id} className="card space-y-3" data-testid="line">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {line.design.product.name}{" "}
                        <span className="font-mono text-xs text-gray-500">{line.design.product.styleCode}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <span className="inline-block h-3 w-3 rounded-full border" style={{ background: line.design.color.hex ?? "#fff" }} />
                        {line.design.color.name} · {qty} pcs
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{money(line.total)}</div>
                      {!line.discountPct.isZero() && (
                        <div className="text-xs text-green-700">{line.discountPct.times(100).toString()}% quantity discount</div>
                      )}
                    </div>
                  </div>

                  {issues.length > 0 && (
                    <ul className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {issues.map((i, n) => <li key={n}>{i.location ? `${i.location}: ` : ""}{i.message}</li>)}
                    </ul>
                  )}

                  <div className="overflow-x-auto">
                    <table className="text-sm">
                      <tbody>
                        <tr className="text-xs text-gray-500">
                          <td className="pr-4">Size</td>
                          {line.sizes.map((s) => <td key={s.id} className="px-2">{s.size.code}</td>)}
                        </tr>
                        <tr>
                          <td className="pr-4 text-xs text-gray-500">Qty</td>
                          {line.sizes.map((s) => <td key={s.id} className="px-2">{s.qty}</td>)}
                        </tr>
                        <tr>
                          <td className="pr-4 text-xs text-gray-500">Each</td>
                          {line.sizes.map((s) => <td key={s.id} className="px-2">{money(s.unitPrice)}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {line.design.decorations.length > 0 ? (
                    <ul className="space-y-0.5 text-sm">
                      {line.design.decorations.map((d) => (
                        <li key={d.id}>
                          <span className="font-medium">{d.location}</span>: {d.method.shortName}
                          {d.colors ? ` · ${d.colors} color${d.colors === 1 ? "" : "s"}` : ""}
                          {d.stitches ? ` · ${d.stitches.toLocaleString()} stitches` : ""}
                          {d.widthIn && d.heightIn ? ` · ${d.widthIn.toString()}″ × ${d.heightIn.toString()}″` : ""}
                          {d.inkColors.length ? ` · ${d.inkColors.join(", ")}` : ""}
                          {d.needsArtwork ? " · needs artwork" : ""}
                          {d.needsDigitizing ? " · needs digitizing" : ""}
                          {d.reuseScreens ? " · reuse screens" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">Blank (no decoration)</p>
                  )}
                  <p className="text-xs text-gray-500">Decoration {money(line.decorationUnit)} per piece</p>
                  {fees.length > 0 && (
                    <ul className="text-sm text-gray-700">
                      {fees.map((f, i) => <li key={i}>{f.location}: {f.description} — {money(f.amount)}</li>)}
                    </ul>
                  )}
                  {line.notes && <p className="text-sm italic text-gray-600">{line.notes}</p>}

                  {editable && (
                    <div className="flex flex-wrap gap-3">
                      <details className="w-full">
                        <summary className="cursor-pointer text-sm text-amber-700">Edit item</summary>
                        <div className="mt-3">
                          <ActionForm action={updateLineAction} submitLabel="Save item">
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <LineEditor products={products} initial={lineValue(line)} />
                          </ActionForm>
                        </div>
                      </details>
                      <ActionForm action={removeLineAction} submitLabel="Remove item" danger confirm="Remove this item?">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="lineId" value={line.id} />
                      </ActionForm>
                    </div>
                  )}
                </div>
              );
            })}
            {editable && (
              <details className="card" open={order.lines.length === 0}>
                <summary className="cursor-pointer font-medium text-amber-700">+ Add item</summary>
                <div className="mt-3">
                  {/* Keyed on the line count so the editor starts fresh after each add. */}
                  <ActionForm key={order.lines.length} action={addLineAction} submitLabel="Add item">
                    <input type="hidden" name="orderId" value={order.id} />
                    <LineEditor products={products} />
                  </ActionForm>
                </div>
              </details>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 font-semibold">Details</h2>
            <fieldset disabled={!editable}>
              <ActionForm action={saveDetailsAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Title / job name" name="title" value={order.title ?? ""} />
                  <Field label="Due date" name="dueDate" type="date" value={order.dueDate?.toISOString().slice(0, 10) ?? ""} />
                  <Field label="Shipping ($)" name="shipping" value={order.shipping.toFixed(2)} />
                  <div>
                    <label className="label" htmlFor="pricingGroupId">Pricing group</label>
                    <select className="input" id="pricingGroupId" name="pricingGroupId" defaultValue={order.pricingGroupId ?? ""}>
                      <option value="">Customer&apos;s group</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input type="checkbox" name="rush" defaultChecked={order.rush} /> Rush
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input type="checkbox" name="taxExempt" defaultChecked={order.taxExempt} /> Tax exempt (this {isQuote ? "quote" : "order"})
                  </label>
                </div>
                <div className="label">Ship to</div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Name" name="shipName" value={order.shipName ?? ""} />
                  <Field label="Street" name="shipLine1" value={order.shipLine1 ?? ""} />
                  <Field label="Apt / suite" name="shipLine2" value={order.shipLine2 ?? ""} />
                  <Field label="City" name="shipCity" value={order.shipCity ?? ""} />
                  <Field label="State" name="shipRegion" value={order.shipRegion ?? ""} />
                  <Field label="ZIP" name="shipPostalCode" value={order.shipPostalCode ?? ""} />
                  <Field label="Country" name="shipCountry" value={order.shipCountry} />
                </div>
                <div>
                  <label className="label" htmlFor="customerNotes">Notes for the customer</label>
                  <textarea className="input min-h-16" id="customerNotes" name="customerNotes" defaultValue={order.customerNotes ?? ""} />
                </div>
              </ActionForm>
            </fieldset>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card text-sm" data-testid="totals">
            <h2 className="mb-2 font-semibold">Totals</h2>
            <dl className="space-y-1">
              <Row label="Merchandise" value={money(order.merchandise)} />
              <Row label="Setup & service fees" value={money(order.feesTotal)} />
              {!order.rushFee.isZero() && <Row label="Rush" value={money(order.rushFee)} />}
              <Row label="Shipping" value={money(order.shipping)} />
              <Row label={order.shipRegion ? `Tax (${order.shipRegion})` : "Tax (no ship-to state)"} value={money(order.tax)} />
              <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd data-testid="order-total">{money(order.total)}</dd>
              </div>
            </dl>
            {order.pricingGroup && <p className="mt-2 text-xs text-gray-500">Priced with {order.pricingGroup.name}</p>}
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Activity</h2>
            <ActionForm action={addNoteAction} submitLabel="Add note" resetOnSuccess>
              <input type="hidden" name="orderId" value={order.id} />
              <textarea className="input min-h-16" name="body" aria-label="Note" placeholder="Internal note (staff only)" required />
            </ActionForm>
            <ol className="space-y-3 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className={e.type === "NOTE" ? "rounded-md bg-amber-50 p-2" : ""}>
                  <div className="whitespace-pre-wrap">{e.body}</div>
                  <div className="text-xs text-gray-500">{e.staff?.name ?? "System"} · {when(e.createdAt)}</div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-600">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Field({ label, name, value, type }: { label: string; name: string; value: string; type?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={type} defaultValue={value} />
    </div>
  );
}
