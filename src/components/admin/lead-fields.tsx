import type { Lead, LeadStatus } from "@prisma/client";
import { LEAD_SOURCES } from "@/lib/crm/leads";

export const STATUS_CLASS: Record<LeadStatus, string> = {
  NEW: "bg-blue-50 text-blue-800",
  CONTACTED: "bg-amber-50 text-amber-800",
  QUALIFIED: "bg-purple-50 text-purple-800",
  CONVERTED: "bg-green-50 text-green-800",
  LOST: "bg-gray-100 text-gray-600",
};

/** The lead's contact and opportunity fields (inside an <ActionForm>). */
export function LeadFields({ lead, staff, defaultOwnerId }: { lead?: Lead; staff: { id: string; name: string }[]; defaultOwnerId?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="First name" name="firstName" value={lead?.firstName} required />
      <Field label="Last name" name="lastName" value={lead?.lastName} />
      <Field label="Organization" name="organization" value={lead?.organization} placeholder="School, team, business…" />
      <Field label="Title" name="title" value={lead?.title} placeholder="Athletic director" />
      <Field label="Email" name="email" type="email" value={lead?.email} />
      <Field label="Phone" name="phone" value={lead?.phone} />
      <div>
        <label className="label" htmlFor="lead-source">Source</label>
        <input className="input" id="lead-source" name="source" list="lead-sources" defaultValue={lead?.source ?? ""} placeholder="How they found you" />
        <datalist id="lead-sources">{LEAD_SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      <div>
        <label className="label" htmlFor="lead-owner">Owner</label>
        <select className="input" id="lead-owner" name="ownerId" defaultValue={lead ? (lead.ownerId ?? "") : (defaultOwnerId ?? "")}>
          <option value="">Nobody yet</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="lead-interest">What they&apos;re after</label>
        <textarea className="input min-h-16" id="lead-interest" name="interest" defaultValue={lead?.interest ?? ""} placeholder="Spring soccer uniforms, about 60 pieces, needed by March" />
      </div>
      <Field label="Estimated value ($)" name="estimatedValue" value={lead?.estimatedValue?.toFixed(2)} inputMode="decimal" />
    </div>
  );
}

function Field({ label, name, value, type, required, placeholder, inputMode }: { label: string; name: string; value?: string | null; type?: string; required?: boolean; placeholder?: string; inputMode?: "decimal" }) {
  return (
    <div>
      <label className="label" htmlFor={`lead-${name}`}>{label}</label>
      <input className="input" id={`lead-${name}`} name={name} type={type} defaultValue={value ?? ""} required={required} placeholder={placeholder} inputMode={inputMode} />
    </div>
  );
}
