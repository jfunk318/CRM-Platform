import type { Prisma, ProofStatus } from "@prisma/client";
import { FILE_KIND_LABELS } from "@/lib/files/order-files";
import { isImage, MAX_UPLOAD_MB } from "@/lib/files/types";
import { invoiceRef } from "@/lib/orders/numbers";
import { balances } from "@/lib/orders/payments";
import { ActionForm } from "@/components/admin/action-form";
import { CopyLink } from "@/components/admin/copy-link";
import { Disclosure } from "@/components/admin/disclosure";
import { FilePicker } from "@/components/file-picker";
import {
  cancelProofAction,
  createLinkAction,
  createProofAction,
  invoiceAction,
  recordPaymentAction,
  removeFileAction,
  sendProofAction,
  sendQuoteAction,
  setDepositAction,
  uploadFilesAction,
} from "../actions";

export const orderSectionsInclude = {
  files: { orderBy: { createdAt: "desc" }, include: { file: true } },
  proofs: { orderBy: { number: "desc" }, include: { files: { orderBy: { sortOrder: "asc" }, include: { file: true } } } },
  payments: { orderBy: { receivedAt: "desc" }, include: { staff: { select: { name: true } } } },
  emails: { orderBy: { createdAt: "desc" }, take: 30 },
} satisfies Prisma.OrderInclude;

type OrderWithSections = Prisma.OrderGetPayload<{ include: typeof orderSectionsInclude & { customer: true; convertedTo: true } }>;

const money = (v: { toFixed(n: number): string }) => {
  const s = v.toFixed(2);
  return s.startsWith("-") ? `−$${s.slice(1)}` : `$${s}`;
};
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
/** Date-only fields are stored as UTC midnight. */
const dateOnly = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);
const fileUrl = (id: string, download = false) => `/admin/files/${id}${download ? "?download=1" : ""}`;

/** Customer link, sending the quote, and the customer's approval. */
export function CustomerLinkSection({ order, origin, canEdit }: { order: OrderWithSections; origin: string; canEdit: boolean }) {
  const isQuote = order.type === "QUOTE";
  const link = order.publicToken ? `${origin}/c/${order.publicToken}` : null;
  return (
    <section className="card space-y-3" data-testid="customer-section">
      <h2 className="font-semibold">Customer</h2>
      {order.approvedAt ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Approved online by {order.approvedByName} on {day(order.approvedAt)}
        </p>
      ) : (
        isQuote && <p className="text-sm text-gray-500">Not approved yet.</p>
      )}
      <div className="text-sm">
        <div className="label">Customer link ({isQuote ? "review and approve" : "order status, proofs and invoice"})</div>
        {link ? (
          <CopyLink url={link} />
        ) : canEdit ? (
          <ActionForm action={createLinkAction} submitLabel="Create link" className="flex items-center gap-3">
            <input type="hidden" name="orderId" value={order.id} />
          </ActionForm>
        ) : (
          <span className="text-gray-500">None yet</span>
        )}
      </div>
      {isQuote && canEdit && !order.convertedTo && (
        <ActionForm action={sendQuoteAction} submitLabel={`Email quote to ${order.customer.email ?? "customer"}`}>
          <input type="hidden" name="orderId" value={order.id} />
          <textarea className="input min-h-14" name="message" aria-label="Message to the customer" placeholder="Message to include (optional)" />
        </ActionForm>
      )}
    </section>
  );
}

export function FilesSection({ order, canEdit }: { order: OrderWithSections; canEdit: boolean }) {
  return (
    <section className="card space-y-3" data-testid="files-section">
      <h2 className="font-semibold">Files</h2>
      {order.files.length === 0 && <p className="text-sm text-gray-500">No files yet.</p>}
      <ul className="divide-y divide-gray-100 text-sm">
        {order.files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 py-2">
            {isImage(f.file.name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(f.file.id)} alt="" className="h-10 w-10 rounded border object-contain" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded border text-[10px] text-gray-500 uppercase">
                {f.file.name.split(".").pop()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <a href={fileUrl(f.file.id)} target="_blank" rel="noreferrer" className="block truncate text-amber-700 hover:underline">
                {f.file.name}
              </a>
              <div className="text-xs text-gray-500">
                {FILE_KIND_LABELS[f.kind]} · {size(f.file.size)} · {day(f.createdAt)}
                {f.note ? ` · ${f.note}` : ""}
              </div>
            </div>
            <a href={fileUrl(f.file.id, true)} className="text-xs text-gray-600 hover:underline">Download</a>
            {canEdit && (
              <ActionForm action={removeFileAction} submitLabel="Remove" danger confirm={`Remove ${f.file.name}?`} className="flex">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="orderFileId" value={f.id} />
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <ActionForm action={uploadFilesAction} submitLabel="Upload" resetOnSuccess className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="orderId" value={order.id} />
          <div className="min-w-72 flex-1">
            <label className="label" htmlFor="up-files">Add files (up to {MAX_UPLOAD_MB} MB each)</label>
            <FilePicker id="up-files" name="files" multiple required maxMb={MAX_UPLOAD_MB} />
          </div>
          <div>
            <label className="label" htmlFor="up-kind">Type</label>
            <select className="input" id="up-kind" name="kind" defaultValue="ARTWORK">
              {Object.entries(FILE_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </ActionForm>
      )}
    </section>
  );
}

const PROOF_LABELS: Record<ProofStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
  SENT: { label: "Waiting for customer", cls: "bg-blue-100 text-blue-800" },
  APPROVED: { label: "Approved", cls: "bg-green-100 text-green-800" },
  CHANGES_REQUESTED: { label: "Changes requested", cls: "bg-amber-100 text-amber-900" },
  CANCELLED: { label: "Cancelled", cls: "bg-gray-100 text-gray-500" },
};

export function ProofsSection({ order, origin, canEdit }: { order: OrderWithSections; origin: string; canEdit: boolean }) {
  return (
    <section className="card space-y-3" data-testid="proofs-section">
      <h2 className="font-semibold">Artwork proofs</h2>
      {order.proofs.length === 0 && <p className="text-sm text-gray-500">No proofs yet.</p>}
      {order.proofs.map((p) => (
        <div key={p.id} className="space-y-2 rounded-md border border-gray-200 p-3 text-sm" data-testid="proof">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Proof {p.number}</span>
            <span className={`rounded px-2 py-0.5 text-xs ${PROOF_LABELS[p.status].cls}`}>{PROOF_LABELS[p.status].label}</span>
            {p.sentAt && <span className="text-xs text-gray-500">sent {day(p.sentAt)}</span>}
          </div>
          {p.message && <p className="text-gray-700">{p.message}</p>}
          <div className="flex flex-wrap gap-2">
            {p.files.map((pf) => (
              <a key={pf.id} href={fileUrl(pf.file.id)} target="_blank" rel="noreferrer" title={pf.file.name} className="block">
                {isImage(pf.file.name) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(pf.file.id)} alt={pf.file.name} className={`h-16 w-16 rounded border object-contain ${pf.fromCustomer ? "border-amber-400" : ""}`} />
                ) : (
                  <span className="text-xs text-amber-700 underline">{pf.file.name}</span>
                )}
              </a>
            ))}
          </div>
          {p.respondedAt && (
            <p className={p.status === "APPROVED" ? "text-green-800" : "text-amber-900"}>
              {p.responderName} on {day(p.respondedAt)}: {p.responseNote || (p.status === "APPROVED" ? "approved" : "")}
            </p>
          )}
          {p.status !== "DRAFT" && p.status !== "CANCELLED" && <CopyLink url={`${origin}/proof/${p.token}`} />}
          {canEdit && (p.status === "DRAFT" || p.status === "SENT") && (
            <div className="flex flex-wrap gap-2">
              <ActionForm action={sendProofAction} submitLabel={p.status === "DRAFT" ? "Send to customer" : "Send again"} className="flex items-center gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="proofId" value={p.id} />
              </ActionForm>
              <ActionForm action={cancelProofAction} submitLabel="Cancel proof" danger confirm={`Cancel proof ${p.number}?`} className="flex items-center gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="proofId" value={p.id} />
              </ActionForm>
            </div>
          )}
        </div>
      ))}
      {canEdit && (
        <Disclosure className="rounded-md border border-dashed border-gray-300 p-3" initiallyOpen={order.proofs.length === 0}>
          <summary className="cursor-pointer text-sm font-medium text-amber-700">+ New proof</summary>
          <ActionForm action={createProofAction} submitLabel="Create proof" resetOnSuccess className="mt-3 space-y-3">
            <input type="hidden" name="orderId" value={order.id} />
            {order.files.length > 0 && (
              <fieldset>
                <legend className="label">Use files from this order</legend>
                <div className="flex flex-wrap gap-3 text-sm">
                  {order.files.map((f) => (
                    <label key={f.id} className="flex items-center gap-1.5">
                      <input type="checkbox" name="orderFileIds" value={f.id} defaultChecked={f.kind === "MOCKUP"} /> {f.file.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <label className="label" htmlFor="pf-files">…and/or upload proof images or PDFs</label>
              <FilePicker id="pf-files" name="files" multiple maxMb={MAX_UPLOAD_MB} hint="images or PDFs" />
            </div>
            <div>
              <label className="label" htmlFor="pf-message">Message to the customer</label>
              <textarea className="input min-h-14" id="pf-message" name="message" placeholder="e.g. Please check the colors and placement" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="sendNow" defaultChecked /> Email it to {order.customer.email ?? "the customer"} now
            </label>
          </ActionForm>
        </Disclosure>
      )}
    </section>
  );
}

export function PaymentsSection({
  order,
  canEdit,
  canRefund,
  suggestedDeposit,
  origin,
}: {
  order: OrderWithSections;
  canEdit: boolean;
  canRefund: boolean;
  suggestedDeposit: string;
  origin: string;
}) {
  const { balance, depositDue } = balances(order);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="card space-y-3 text-sm" data-testid="payments-section">
      <h2 className="font-semibold">Payments &amp; invoice</h2>
      <dl className="space-y-1">
        <div className="flex justify-between"><dt className="text-gray-600">Total</dt><dd>{money(order.total)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-600">Paid</dt><dd>{money(order.paidTotal)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd data-testid="admin-balance">{money(balance)}</dd></div>
        {!order.depositRequired.isZero() && (
          <div className="flex justify-between text-gray-600">
            <dt>Deposit {money(order.depositRequired)}</dt>
            <dd>{depositDue.gt(0) ? `${money(depositDue)} still due` : "paid"}</dd>
          </div>
        )}
      </dl>

      {order.payments.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {order.payments.map((p) => (
            <li key={p.id} className="flex justify-between py-1.5">
              <span>
                {day(p.receivedAt)} · {p.method.toLowerCase().replace("_", " ")}
                {p.reference ? ` ${p.reference}` : ""}
                {p.note ? ` · ${p.note}` : ""}
                <span className="text-xs text-gray-400"> · {p.staff?.name ?? "—"}</span>
              </span>
              <span className={p.amount.isNegative() ? "text-red-600" : ""}>{money(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          <details className="rounded-md border border-dashed border-gray-300 p-3">
            <summary className="cursor-pointer font-medium text-amber-700">+ Record payment</summary>
            <ActionForm action={recordPaymentAction} submitLabel="Record" resetOnSuccess className="mt-3 space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="pay-amount">Amount ($)</label>
                  <input className="input" id="pay-amount" name="amount" defaultValue={balance.gt(0) ? balance.toFixed(2) : ""} required />
                </div>
                <div>
                  <label className="label" htmlFor="pay-method">Method</label>
                  <select className="input" id="pay-method" name="method" defaultValue="CARD">
                    <option value="CASH">Cash</option>
                    <option value="CHECK">Check</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="pay-ref">Reference</label>
                  <input className="input" id="pay-ref" name="reference" placeholder="Check #, last 4" />
                </div>
                <div>
                  <label className="label" htmlFor="pay-date">Date</label>
                  <input className="input" id="pay-date" name="receivedAt" type="date" defaultValue={today} />
                </div>
              </div>
              <input className="input" name="note" aria-label="Payment note" placeholder="Note (optional)" />
              {canRefund && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="refund" /> This is a refund
                </label>
              )}
            </ActionForm>
          </details>

          <ActionForm action={setDepositAction} submitLabel="Set deposit" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="label" htmlFor="deposit">Deposit required ($)</label>
              <input className="input w-28" id="deposit" name="deposit" defaultValue={order.depositRequired.isZero() ? suggestedDeposit : order.depositRequired.toFixed(2)} />
            </div>
          </ActionForm>

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <div className="label">Invoice</div>
            {order.invoiceNumber ? (
              <p>
                {invoiceRef(order.invoiceNumber)} issued {day(order.invoicedAt!)}
                {order.invoiceDueDate && <> · due {dateOnly(order.invoiceDueDate)}</>}
              </p>
            ) : (
              <p className="text-gray-500">Not invoiced yet.</p>
            )}
            {order.publicToken && order.invoiceNumber && <CopyLink url={`${origin}/c/${order.publicToken}`} label="Copy invoice link" />}
            <ActionForm action={invoiceAction} submitLabel={order.invoiceNumber ? "Update invoice" : "Issue invoice"} className="space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <div>
                <label className="label" htmlFor="inv-due">Due date</label>
                <input className="input w-40" id="inv-due" name="dueDate" type="date" defaultValue={order.invoiceDueDate?.toISOString().slice(0, 10) ?? ""} />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="send" defaultChecked={!order.invoiceNumber} /> Email it to {order.customer.email ?? "the customer"}
              </label>
            </ActionForm>
          </div>
        </>
      )}
    </section>
  );
}

const EMAIL_STATUS = { SENT: "sent", FAILED: "failed", LOGGED: "not sent (email not set up)" } as const;

export function EmailsSection({ order }: { order: OrderWithSections }) {
  if (order.emails.length === 0) return null;
  return (
    <section className="card space-y-2 text-sm" data-testid="emails-section">
      <h2 className="font-semibold">Emails</h2>
      <ul className="space-y-2">
        {order.emails.map((e) => (
          <li key={e.id}>
            <details>
              <summary className="cursor-pointer">
                <span className={e.status === "FAILED" ? "text-red-600" : ""}>{e.subject}</span>
                <span className="block text-xs text-gray-500">
                  to {e.to} · {day(e.createdAt)} · {EMAIL_STATUS[e.status]}
                </span>
              </summary>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">{e.text}</pre>
              {e.error && <p className="text-xs text-red-600">{e.error}</p>}
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
