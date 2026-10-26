import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { LEAD_STATUS_LABELS, leadSummary, OPEN_LEAD_STATUSES } from "@/lib/crm/leads";
import { ActionForm } from "@/components/admin/action-form";
import { LeadFields, STATUS_CLASS } from "@/components/admin/lead-fields";
import { createLeadAction } from "./actions";

export const metadata = { title: "Leads" };

const money = (v: { toFixed(n: number): string }) => `$${Number(v.toFixed(0)).toLocaleString()}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const VIEWS = { open: "Open", ...LEAD_STATUS_LABELS, all: "All" } as const;
type View = keyof typeof VIEWS;

/** People who might buy: filter by status and owner, search, add new ones. */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ view?: string; owner?: string; q?: string }> }) {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "open";
  const owner = sp.owner ?? "";
  const q = sp.q?.trim() ?? "";
  const where: Prisma.LeadWhereInput = {
    ...(view === "open" ? { status: { in: OPEN_LEAD_STATUSES } } : view === "all" ? {} : { status: view as LeadStatus }),
    ...(owner === "me" ? { ownerId: staff.id } : owner === "none" ? { ownerId: null } : owner ? { ownerId: owner } : {}),
    AND: q.split(/\s+/).filter(Boolean).map((t) => ({
      OR: [
        { firstName: { contains: t, mode: "insensitive" as const } },
        { lastName: { contains: t, mode: "insensitive" as const } },
        { organization: { contains: t, mode: "insensitive" as const } },
        { email: { contains: t, mode: "insensitive" as const } },
        { phone: { contains: t } },
        { interest: { contains: t, mode: "insensitive" as const } },
      ],
    })),
  };
  const [leads, summary, staffList] = await Promise.all([
    db.lead.findMany({ where, include: { owner: { select: { name: true } } }, orderBy: [{ updatedAt: "desc" }], take: 200 }),
    leadSummary(db),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const href = (p: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries({ view, owner, q, ...p }).filter(([k, v]) => v && !(k === "view" && v === "open")));
    return `/admin/leads${qs.size ? `?${qs}` : ""}`;
  };
  const openCount = OPEN_LEAD_STATUSES.reduce((n, s) => n + summary.counts[s], 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="text-sm text-gray-600">
            {openCount} open lead{openCount === 1 ? "" : "s"}
            {summary.openValue.gt(0) && <>, worth about {money(summary.openValue)}</>}
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Lead status">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={href({ view: v })} className={`rounded-full border px-3 py-1 ${view === v ? "border-amber-500 bg-amber-50 font-medium" : "border-gray-200 bg-white hover:border-amber-300"}`}>
            {VIEWS[v]}
            <span className="ml-1 text-gray-500">{v === "open" ? openCount : v === "all" ? Object.values(summary.counts).reduce((a, b) => a + b, 0) : summary.counts[v as LeadStatus]}</span>
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-2">
        {view !== "open" && <input type="hidden" name="view" value={view} />}
        <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Name, organization, email, phone" aria-label="Search leads" />
        <select className="input w-44" name="owner" defaultValue={owner} aria-label="Owner">
          <option value="">Anyone&apos;s</option>
          <option value="me">Mine</option>
          <option value="none">Nobody&apos;s yet</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table" data-testid="leads">
          <thead>
            <tr>
              <th>Lead</th>
              <th>After</th>
              <th>Source</th>
              <th>Status</th>
              <th>Owner</th>
              <th className="text-right">Value</th>
              <th>Last contact</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="text-gray-500">{q || owner || view !== "open" ? "No leads match." : "No open leads. Add one below."}</td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/admin/leads/${l.id}`} className="font-medium text-amber-700 hover:underline">{l.firstName} {l.lastName}</Link>
                  <div className="text-xs text-gray-500">{[l.title, l.organization].filter(Boolean).join(", ")}</div>
                </td>
                <td className="max-w-64 truncate text-sm text-gray-700" title={l.interest ?? ""}>{l.interest?.split("\n")[0] ?? ""}</td>
                <td className="text-sm">{l.source ?? <span className="text-gray-400">—</span>}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_CLASS[l.status]}`}>{LEAD_STATUS_LABELS[l.status]}</span></td>
                <td className="text-sm">{l.owner?.name ?? <span className="text-gray-400">—</span>}</td>
                <td className="text-right text-sm">{l.estimatedValue ? money(l.estimatedValue) : ""}</td>
                <td className="text-sm text-gray-600">{l.lastContactAt ? day(l.lastContactAt) : <span className="text-gray-400">added {day(l.createdAt)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-medium text-amber-700">+ Add a lead</summary>
        <ActionForm action={createLeadAction} submitLabel="Add lead" className="mt-3 space-y-3">
          <LeadFields staff={staffList} defaultOwnerId={staff.id} />
          <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" name="addAnyway" /> Add anyway if they&apos;re already on file</label>
        </ActionForm>
      </details>
    </div>
  );
}
