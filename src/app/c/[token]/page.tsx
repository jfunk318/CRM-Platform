import Link from "next/link";
import { notFound } from "next/navigation";
import { forBusiness } from "@/lib/db";
import { getRequestBusiness } from "@/lib/business";
import { invoiceRef, orderRef } from "@/lib/orders/numbers";
import { orderByToken } from "@/lib/orders/customer-flow";
import { balances } from "@/lib/orders/payments";
import { carrierName, trackingUrl } from "@/lib/shipping/labels";
import { ActionForm } from "@/components/admin/action-form";
import { CustomerShell } from "@/components/customer/shell";
import { OrderItems } from "@/components/customer/order-items";
import { designMockups } from "@/lib/design/mockups";
import { PrintButton } from "@/components/customer/print-button";
import { requestOrigin } from "@/lib/business";
import { stripeKeys } from "@/lib/payments/stripe";
import { completeCheckoutSession } from "@/lib/store/checkout";
import { payOrderAction } from "@/app/(store)/actions";
import { approveQuote, requestQuoteChanges } from "../actions";

export const metadata = { robots: { index: false, follow: false } };

const money = (v: { toFixed(n: number): string }) => {
  const s = v.toFixed(2);
  return s.startsWith("-") ? `−$${s.slice(1)}` : `$${s}`;
};
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const PROOF_STATUS = {
  DRAFT: "Draft",
  SENT: "Waiting for your review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  CANCELLED: "Replaced",
} as const;

/** The customer's view of a quote, or of an order with its proofs, payments and invoice. */
export default async function CustomerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const business = await getRequestBusiness();
  if (!business || business.status !== "ACTIVE") notFound();
  const { token } = await params;
  const db = forBusiness(business.id);
  const keys = stripeKeys(business);
  // Back from paying online: record it now in case the webhook is slower.
  const { session_id } = await searchParams;
  const justPaid = !!(session_id && keys && (await completeCheckoutSession(db, keys, session_id, await requestOrigin()).catch(() => null)));
  const order = await orderByToken(db, token);
  if (!order) notFound();

  const isQuote = order.type === "QUOTE";
  const quoteOpen = isQuote && !order.convertedTo && !order.status.isClosed;
  const { balance, depositDue } = balances(order);
  const title = isQuote
    ? `Quote ${orderRef(order)}`
    : order.invoiceNumber
      ? `Invoice ${invoiceRef(order.invoiceNumber)} · Order ${orderRef(order)}`
      : `Order ${orderRef(order)}`;
  const shipTo = [order.shipName, order.shipLine1, order.shipLine2, [order.shipCity, order.shipRegion, order.shipPostalCode].filter(Boolean).join(", ")]
    .filter(Boolean);

  return (
    <CustomerShell business={business}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {order.title && <p className="text-gray-700">{order.title}</p>}
          <p className="text-sm text-gray-600">
            For {order.customer.firstName} {order.customer.lastName} · {day(order.createdAt)}
            {!isQuote && <> · Status: {order.status.name}</>}
            {!isQuote && order.deliveryMethod && <> · {order.deliveryMethod.name}</>}
            {order.dueDate && <> · Needed by {day(order.dueDate)}</>}
          </p>
        </div>
        <PrintButton />
      </div>

      {isQuote && order.convertedTo && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          This quote has become order {orderRef(order.convertedTo)}.
          {order.convertedTo.publicToken && (
            <>
              {" "}
              <Link href={`/c/${order.convertedTo.publicToken}`} className="font-medium underline">View your order</Link>
            </>
          )}
        </p>
      )}

      {order.customerNotes && <p className="card whitespace-pre-wrap text-sm">{order.customerNotes}</p>}

      <OrderItems lines={order.lines} mockups={await designMockups(db, order.lines.map((l) => l.designId))} artBase={`/c/${token}/art/`} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card text-sm">
          {shipTo.length > 0 && (
            <>
              <div className="label">Ship to</div>
              {shipTo.map((l, i) => <div key={i}>{l}</div>)}
            </>
          )}
          {!isQuote && order.invoiceNumber && (
            <div className="mt-3 space-y-0.5">
              <div className="label">Invoice</div>
              <div>{invoiceRef(order.invoiceNumber)} issued {day(order.invoicedAt!)}</div>
              {order.invoiceDueDate && <div>Due {day(order.invoiceDueDate)}</div>}
              {business.invoiceTerms && <div className="text-gray-600">{business.invoiceTerms}</div>}
            </div>
          )}
        </div>
        <dl className="card space-y-1 text-sm" data-testid="customer-totals">
          <Row label="Items" value={money(order.merchandise)} />
          {!order.discount.isZero() && <Row label="Discount" value={`−${money(order.discount)}`} />}
          {!order.feesTotal.isZero() && <Row label="Setup & service fees" value={money(order.feesTotal)} />}
          {!order.rushFee.isZero() && <Row label="Rush" value={money(order.rushFee)} />}
          {!order.shipping.isZero() && <Row label="Shipping" value={money(order.shipping)} />}
          <Row label="Tax" value={money(order.tax)} />
          <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
          {!isQuote && (
            <>
              {order.payments.map((p) => (
                <Row key={p.id} label={`${p.amount.isNegative() ? "Refund" : "Paid"} ${day(p.receivedAt)}`} value={money(p.amount.negated())} />
              ))}
              <div className="flex justify-between font-semibold">
                <dt>Balance due</dt>
                <dd data-testid="balance">{money(balance)}</dd>
              </div>
              {depositDue.gt(0) && <Row label="Deposit due now" value={money(depositDue)} />}
            </>
          )}
        </dl>
      </div>

      {justPaid && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Thank you, your payment was received.</p>}
      {!isQuote && balance.gt(0) && keys && (
        <ActionForm action={payOrderAction} submitLabel={`Pay ${money(depositDue.gt(0) ? depositDue : balance)} online`} className="card flex flex-wrap items-center gap-3 no-print">
          <input type="hidden" name="token" value={token} />
          <span className="text-sm text-gray-600">{depositDue.gt(0) ? "Pay the deposit by card to get started." : "Pay the balance by card."}</span>
        </ActionForm>
      )}

      {!isQuote && balance.gt(0) && business.paymentInstructions && (
        <div className="card text-sm">
          <div className="label">How to pay</div>
          <p className="whitespace-pre-wrap">{business.paymentInstructions}</p>
        </div>
      )}

      {!isQuote && order.shipments.length > 0 && (
        <section className="card" data-testid="customer-shipments">
          <h2 className="mb-2 font-semibold">Delivery</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {order.shipments.map((sh) => {
              const url = trackingUrl(sh.carrier, sh.trackingNumber);
              return (
                <li key={sh.id} className="py-2">
                  <div>
                    {sh.kind === "PICKUP" ? "Picked up" : sh.kind === "DELIVERY" ? "Delivered" : `Shipped${sh.carrier ? ` with ${carrierName(sh.carrier)}` : ""}`} {day(sh.shippedAt)}
                    {sh.trackingNumber && (
                      <>
                        {" · "}
                        {url ? <a href={url} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">Track {sh.trackingNumber}</a> : `Tracking ${sh.trackingNumber}`}
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">{sh.items.map((i) => `${i.qty} × ${i.description}`).join(", ")}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!isQuote && order.proofs.length > 0 && (
        <section className="card no-print">
          <h2 className="mb-2 font-semibold">Artwork proofs</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {order.proofs.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>Proof {p.number} · {PROOF_STATUS[p.status]}</span>
                {p.status !== "CANCELLED" && (
                  <Link href={`/proof/${p.token}`} className="text-amber-700 hover:underline">
                    {p.status === "SENT" ? "Review now" : "View"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isQuote && order.approvedAt && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800" data-testid="approved">
          Approved by {order.approvedByName} on {day(order.approvedAt)}.
        </p>
      )}

      {quoteOpen && !order.approvedAt && (
        <div className="grid gap-4 sm:grid-cols-2 no-print">
          <section className="card space-y-2">
            <h2 className="font-semibold">Approve this quote</h2>
            <ActionForm action={approveQuote} submitLabel="Approve quote">
              <input type="hidden" name="token" value={token} />
              <div>
                <label className="label" htmlFor="approve-name">Your name</label>
                <input className="input" id="approve-name" name="name" required autoComplete="name" />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="agree" className="mt-1" required />
                I approve the items, quantities and total of {money(order.total)} shown above.
              </label>
            </ActionForm>
          </section>
          <section className="card space-y-2">
            <h2 className="font-semibold">Need changes?</h2>
            <ActionForm action={requestQuoteChanges} submitLabel="Send request">
              <input type="hidden" name="token" value={token} />
              <div>
                <label className="label" htmlFor="change-name">Your name</label>
                <input className="input" id="change-name" name="name" required autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="change-note">What would you like changed?</label>
                <textarea className="input min-h-24" id="change-note" name="note" required />
              </div>
            </ActionForm>
          </section>
        </div>
      )}
    </CustomerShell>
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
