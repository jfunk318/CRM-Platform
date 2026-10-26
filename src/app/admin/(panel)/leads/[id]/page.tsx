import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { CONTACT_TYPES, LEAD_STATUS_LABELS, possibleDuplicates } from "@/lib/crm/leads";
import { orderRef } from "@/lib/orders/numbers";
import { ActionForm } from "@/components/admin/action-form";
import { LeadFields, STATUS_CLASS } from "@/components/admin/lead-fields";
import { convertLeadAction, deleteLeadAction, logContactAction, saveLeadAction } from "../actions";

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const EVENT_LABEL: Record<string, string> = { CALL: "📞 Call", EMAIL: "✉️ Email", MEETING: "🤝 Meeting", NOTE: "Note", STATUS: "Update", CREATED: "Added", CONVERTED: "Converted" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { customer: { include: { company: true } }, quote: true, owner: true, createdBy: true, events: { orderBy: { createdAt: "desc" }, include: { staff: { select: { name: true } } } } },
  });
  if (!lead) notFound();
  const [staffList, dupes] = await Promise.all([
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    lead.status === "CONVERTED" ? null : possibleDuplicates(db, { email: lead.email, phone: lead.phone }, lead.id),
  ]);
  const converted = lead.status === "CONVERTED";
  const others = dupes ? [...dupes.customers.filter((c) => c.id !== lead.customerId), ...dupes.leads] : [];

  return (
    <div className="space-y-5">
      <Link href="/admin/leads" className="text-sm text-amber-700 hover:underline">← Leads</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title flex flex-wrap items-center gap-2">
            {lead.firstName} {lead.lastName}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[lead.status]}`} data-testid="lead-status">{LEAD_STATUS_LABELS[lead.status]}</span>
          </h1>
          <p className="text-sm text-gray-600">
            {[lead.title, lead.organization].filter(Boolean).join(", ")}
            {lead.email && <> · <a href={`mailto:${lead.email}`} className="text-amber-700 hover:underline">{lead.email}</a></>}
            {lead.phone && <> · <a href={`tel:${lead.phone}`} className="text-amber-700 hover:underline">{lead.phone}</a></>}
          </p>
        </div>
      </div>

      {others.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="lead-duplicates">
          Same email or phone as{" "}
          {others.map((o, i) => (
            <span key={o.id}>
              {i > 0 && ", "}
              <Link href={"status" in o ? `/admin/leads/${o.id}` : `/admin/customers/${o.id}`} className="underline">
                {"status" in o ? "lead" : "customer"} {o.firstName} {o.lastName}
              </Link>
            </span>
          ))}
          .
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="font-semibold">Log contact</h2>
            <ActionForm action={logContactAction} submitLabel="Add to timeline" resetOnSuccess className="space-y-2">
              <input type="hidden" name="id" value={lead.id} />
              <div className="flex flex-wrap gap-3 text-sm">
                {Object.entries(CONTACT_TYPES).map(([k, label], i) => (
                  <label key={k} className="flex items-center gap-1.5"><input type="radio" name="type" value={k} defaultChecked={i === 0} /> {label}</label>
                ))}
              </div>
              <textarea className="input min-h-16" name="body" aria-label="What happened" placeholder="Talked to Coach Lee: wants a quote for 60 jerseys, call back Tuesday" required />
            </ActionForm>
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Timeline</h2>
            <ol className="space-y-3 text-sm" data-testid="lead-timeline">
              {lead.events.map((e) => (
                <li key={e.id} className={["CALL", "EMAIL", "MEETING"].includes(e.type) ? "rounded-md bg-amber-50 p-2" : ""}>
                  <div className="text-xs font-medium text-gray-500">{EVENT_LABEL[e.type]}</div>
                  <div className="whitespace-pre-wrap">{e.body}</div>
                  <div className="text-xs text-gray-500">{e.staff?.name ?? "System"} · {when(e.createdAt)}</div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-3" data-testid="lead-convert">
            {converted ? (
              <>
                <h2 className="font-semibold">Converted</h2>
                <p className="text-sm">
                  {lead.customer && <Link href={`/admin/customers/${lead.customer.id}`} className="text-amber-700 hover:underline">{lead.customer.firstName} {lead.customer.lastName}</Link>}
                  {lead.customer?.company && <> at {lead.customer.company.name}</>}
                  {lead.convertedAt && <span className="text-gray-500"> · {when(lead.convertedAt)}</span>}
                </p>
                {lead.quote && <Link href={`/admin/orders/${lead.quote.id}`} className="text-sm text-amber-700 hover:underline">Quote {orderRef(lead.quote)} →</Link>}
              </>
            ) : (
              <>
                <h2 className="font-semibold">Convert to a customer</h2>
                <p className="text-sm text-gray-600">
                  {lead.customer ? <>Already linked to customer {lead.customer.firstName} {lead.customer.lastName}.</> : "Adds them as a customer (or matches the one with the same email)"}
                  {lead.organization ? `, with ${lead.organization} as their company.` : "."}
                </p>
                <ActionForm action={convertLeadAction} submitLabel="Convert" className="space-y-2">
                  <input type="hidden" name="id" value={lead.id} />
                  {lead.quote ? (
                    <p className="text-sm">Their quote: <Link href={`/admin/orders/${lead.quote.id}`} className="text-amber-700 hover:underline">{orderRef(lead.quote)}</Link></p>
                  ) : (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makeQuote" defaultChecked /> Start a draft quote</label>
                  )}
                </ActionForm>
              </>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Details</h2>
            <ActionForm action={saveLeadAction} className="space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="lead-status">Status</label>
                  <select className="input" id="lead-status" name="status" defaultValue={lead.status}>
                    {Object.entries(LEAD_STATUS_LABELS).filter(([k]) => k !== "CONVERTED" || converted).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="lead-lost">If lost, why</label>
                  <input className="input" id="lead-lost" name="lostReason" defaultValue={lead.lostReason ?? ""} placeholder="Went with another shop" />
                </div>
              </div>
              <LeadFields lead={lead} staff={staffList} />
            </ActionForm>
            <p className="text-xs text-gray-500">Added {when(lead.createdAt)}{lead.createdBy ? ` by ${lead.createdBy.name}` : ""}</p>
            <ActionForm action={deleteLeadAction} submitLabel="Delete lead" danger confirm="Delete this lead and its timeline?">
              <input type="hidden" name="id" value={lead.id} />
            </ActionForm>
          </section>
        </aside>
      </div>
    </div>
  );
}
