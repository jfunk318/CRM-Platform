import { notFound } from "next/navigation";
import { forBusiness } from "@/lib/db";
import { getRequestBusiness } from "@/lib/business";
import { isImage, MAX_UPLOAD_MB } from "@/lib/files/types";
import { orderRef } from "@/lib/orders/numbers";
import { proofByToken } from "@/lib/orders/customer-flow";
import { ActionForm } from "@/components/admin/action-form";
import { CustomerShell } from "@/components/customer/shell";
import { OrderItems } from "@/components/customer/order-items";
import { PrintButton } from "@/components/customer/print-button";
import { respondToProof } from "../actions";

export const metadata = { robots: { index: false, follow: false } };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The customer reviews an artwork proof and approves it or asks for changes. */
export default async function ProofPage({ params }: { params: Promise<{ token: string }> }) {
  const business = await getRequestBusiness();
  if (!business || business.status !== "ACTIVE") notFound();
  const { token } = await params;
  const proof = await proofByToken(forBusiness(business.id), token);
  if (!proof) notFound();

  const shopFiles = proof.files.filter((f) => !f.fromCustomer);
  const customerFiles = proof.files.filter((f) => f.fromCustomer);
  const fileUrl = (fileId: string, download = false) => `/proof/${token}/files/${fileId}${download ? "?download=1" : ""}`;

  return (
    <CustomerShell business={business}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Proof {proof.number} · Order {orderRef(proof.order)}
          </h1>
          <p className="text-sm text-gray-600">
            For {proof.order.customer.firstName} {proof.order.customer.lastName}
            {proof.sentAt && <> · Sent {day(proof.sentAt)}</>}
          </p>
        </div>
        <PrintButton />
      </div>

      {proof.status === "APPROVED" && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800" data-testid="proof-status">
          Approved by {proof.responderName} on {day(proof.respondedAt!)}.{proof.responseNote ? ` “${proof.responseNote}”` : ""}
        </p>
      )}
      {proof.status === "CHANGES_REQUESTED" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="proof-status">
          {proof.responderName} asked for changes on {day(proof.respondedAt!)}: “{proof.responseNote}”. We&apos;ll send a new proof.
        </p>
      )}
      {proof.status === "CANCELLED" && (
        <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700" data-testid="proof-status">
          This proof has been replaced by a newer one. Check your email for the latest proof.
        </p>
      )}

      {proof.message && <p className="card whitespace-pre-wrap text-sm">{proof.message}</p>}

      <section className="space-y-3">
        {shopFiles.map(({ file }) =>
          isImage(file.name) ? (
            <figure key={file.id} className="card break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(file.id)} alt={file.name} className="mx-auto max-h-[80vh] w-auto" />
              <figcaption className="mt-2 text-center text-xs text-gray-500">{file.name}</figcaption>
            </figure>
          ) : (
            <div key={file.id} className="card flex items-center justify-between text-sm">
              <span>{file.name}</span>
              <a href={fileUrl(file.id)} className="btn-secondary" target="_blank" rel="noreferrer">Open</a>
            </div>
          ),
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">What we&apos;re making</h2>
        <OrderItems lines={proof.order.lines} />
      </section>

      {customerFiles.length > 0 && (
        <section className="card text-sm">
          <div className="label">Files you sent</div>
          {customerFiles.map(({ file }) => (
            <a key={file.id} href={fileUrl(file.id, true)} className="block text-amber-700 hover:underline">{file.name}</a>
          ))}
        </section>
      )}

      {proof.status === "SENT" && (
        <div className="grid gap-4 sm:grid-cols-2 no-print">
          <section className="card space-y-2">
            <h2 className="font-semibold">Approve the artwork</h2>
            <p className="text-sm text-gray-600">Please check spelling, colors, size and placement. We print exactly what&apos;s shown.</p>
            <ActionForm action={respondToProof} submitLabel="Approve proof">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="decision" value="approve" />
              <div>
                <label className="label" htmlFor="ap-name">Your name</label>
                <input className="input" id="ap-name" name="name" required autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="ap-note">Note (optional)</label>
                <input className="input" id="ap-note" name="note" />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="agree" className="mt-1" required />I approve this artwork for production.
              </label>
            </ActionForm>
          </section>
          <section className="card space-y-2">
            <h2 className="font-semibold">Request changes</h2>
            <ActionForm action={respondToProof} submitLabel="Send changes">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="decision" value="changes" />
              <div>
                <label className="label" htmlFor="ch-name">Your name</label>
                <input className="input" id="ch-name" name="name" required autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="ch-note">What should we change?</label>
                <textarea className="input min-h-24" id="ch-note" name="note" required />
              </div>
              <div>
                <label className="label" htmlFor="ch-files">Attach files (optional, up to {MAX_UPLOAD_MB} MB each)</label>
                <input className="text-sm" id="ch-files" name="files" type="file" multiple />
              </div>
            </ActionForm>
          </section>
        </div>
      )}
    </CustomerShell>
  );
}
