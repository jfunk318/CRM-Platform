import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { orderRef } from "@/lib/orders/numbers";
import { loadAdminStore } from "@/lib/store/admin";
import { REQUEST_STATUS_LABELS } from "@/lib/store/portal";
import { requestQuoteAction, updateRequestAction } from "../../actions";

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** Requests from the store's owners: answer them, track them, turn them into quotes. */
export default async function RequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, store } = await loadAdminStore((await params).id);
  if (store.kind === "ROOT") notFound();
  const requests = await db.storeRequest.findMany({
    where: { storeId: store.id },
    orderBy: [{ createdAt: "desc" }],
    include: { customer: true, quote: true },
  });
  // New ones first.
  requests.sort((a, b) => Number(b.status === "NEW") - Number(a.status === "NEW"));
  return (
    <div className="space-y-3" data-testid="store-requests">
      {requests.length === 0 && <p className="text-sm text-gray-500">No requests yet. Store owners send them from the portal&apos;s Requests tab.</p>}
      {requests.map((r) => (
        <section key={r.id} className={`card space-y-2 ${r.status === "NEW" ? "border-red-300" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">
                {r.status === "NEW" && <span className="mr-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">New</span>}
                {r.subject}
              </h2>
              <p className="text-xs text-gray-500">
                <Link href={`/admin/customers/${r.customerId}`} className="text-brand-700 hover:underline">{r.customer.firstName} {r.customer.lastName}</Link>
                {r.customer.email ? ` · ${r.customer.email}` : ""} · {when(r.createdAt)}
              </p>
            </div>
            {r.quote ? (
              <Link href={`/admin/orders/${r.quote.id}`} className="text-sm text-brand-700 hover:underline">Quote {orderRef(r.quote)} →</Link>
            ) : (
              <ActionForm action={requestQuoteAction} submitLabel="Make a draft quote" className="flex">
                <input type="hidden" name="id" value={r.id} />
              </ActionForm>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm">{r.body}</p>
          <ActionForm action={updateRequestAction} submitLabel="Save" className="grid gap-2 border-t border-gray-100 pt-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={r.id} />
            <div>
              <label className="label" htmlFor={`st-${r.id}`}>Status</label>
              <select className="input" id={`st-${r.id}`} name="status" defaultValue={r.status === "NEW" ? "IN_PROGRESS" : r.status}>
                {Object.entries(REQUEST_STATUS_LABELS).filter(([k]) => k !== "NEW").map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`re-${r.id}`}>Reply (the owner sees it in the portal and by email)</label>
              <textarea className="input min-h-10" id={`re-${r.id}`} name="reply" defaultValue={r.reply ?? ""} />
            </div>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
