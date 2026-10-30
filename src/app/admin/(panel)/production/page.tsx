import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { orderRef } from "@/lib/orders/numbers";
import { jobPieces } from "@/lib/production/jobs";
import { addDays, today } from "@/lib/production/defaults";
import { orderBlankStatus } from "@/lib/purchasing/service";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { assignJobAction, autoScheduleAction, stepAction } from "./actions";

const jobInclude = {
  method: true,
  assignedTo: { select: { id: true, name: true } },
  steps: { orderBy: { sortOrder: "asc" } },
  order: { include: { customer: true, status: true, proofs: { where: { status: "APPROVED" }, select: { id: true } } } },
} satisfies Prisma.ProductionJobInclude;

export type BoardJob = Prisma.ProductionJobGetPayload<{ include: typeof jobInclude }>;

const day = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const COLUMNS = [
  { status: "QUEUED", title: "Up next" },
  { status: "IN_PROGRESS", title: "In progress" },
  { status: "DONE", title: "Done this week" },
] as const;

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ method?: string; mine?: string }> }) {
  const staff = await requireStaff(["PRODUCTION"]);
  const { db } = staff;
  const { method, mine } = await searchParams;
  const now = today();
  const where: Prisma.ProductionJobWhereInput = {
    OR: [{ status: { not: "DONE" }, order: { status: { isClosed: false } } }, { status: "DONE", completedAt: { gte: addDays(now, -7) } }],
    ...(method ? { methodId: method } : {}),
    ...(mine ? { assignedToId: staff.id } : {}),
  };
  const [jobs, methods, people] = await Promise.all([
    db.productionJob.findMany({
      where,
      include: jobInclude,
      orderBy: [{ scheduledFor: { sort: "asc", nulls: "last" } }, { order: { dueDate: { sort: "asc", nulls: "last" } } }],
    }),
    db.decorationMethod.findMany({ where: { productionJobs: { some: {} } }, orderBy: { sortOrder: "asc" } }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const pieces = await jobPieces(db, jobs);
  const blanks = new Map(
    await Promise.all([...new Set(jobs.map((j) => j.orderId))].map(async (id) => [id, (await orderBlankStatus(db, id)).ready] as const)),
  );
  const filter = (p: { method?: string; mine?: string }) => {
    const q = new URLSearchParams(Object.entries({ method, mine, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/admin/production${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Production</h1>
          <p className="text-sm text-gray-500">Jobs are created when a customer approves a proof, or from the order page.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/production/calendar" className="btn-secondary">Calendar</Link>
          <ActionForm action={autoScheduleAction} submitLabel="Auto-schedule" className="flex items-center gap-2">
            {null}
          </ActionForm>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm">
        <Chip href={filter({ method: "" })} on={!method}>All methods</Chip>
        {methods.map((m) => <Chip key={m.id} href={filter({ method: m.id })} on={method === m.id}>{m.name}</Chip>)}
        <span className="mx-1 text-gray-300">|</span>
        <Chip href={filter({ mine: mine ? "" : "1" })} on={!!mine}>Assigned to me</Chip>
      </nav>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = jobs.filter((j) => j.status === col.status);
          return (
            <section key={col.status} className="space-y-3" data-testid={`col-${col.status}`}>
              <h2 className="font-semibold">{col.title} <span className="text-sm font-normal text-gray-500">({list.length})</span></h2>
              {list.length === 0 && <p className="text-sm text-gray-400">Nothing here.</p>}
              {list.map((j) => (
                <JobCard key={j.id} job={j} pieces={pieces.get(j.id) ?? 0} blanksReady={blanks.get(j.orderId) ?? false} people={people} now={now} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full border px-3 py-1 ${on ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"}`}>
      {children}
    </Link>
  );
}

function JobCard({ job, pieces, blanksReady, people, now }: { job: BoardJob; pieces: number; blanksReady: boolean; people: { id: string; name: string }[]; now: Date }) {
  const o = job.order;
  const late = o.dueDate && o.dueDate < now && job.status !== "DONE";
  const next = job.steps.find((s) => !s.doneAt);
  return (
    <div className="card space-y-2 text-sm" data-testid="job">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{orderRef(o)}</Link>{" "}
          <span className="font-medium">{job.method.name}</span>
          <div className="text-gray-600">{o.customer.firstName} {o.customer.lastName}{o.title ? ` · ${o.title}` : ""}</div>
        </div>
        <div className="text-right text-xs whitespace-nowrap">
          <div className="text-base font-semibold">{pieces} pcs</div>
          {o.rush && <span className="rounded bg-red-100 px-1 text-red-700">Rush</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
        <span className={late ? "font-medium text-red-600" : ""}>Due {o.dueDate ? day(o.dueDate) : "—"}</span>
        <span>On {job.scheduledFor ? day(job.scheduledFor) : "not scheduled"}</span>
        <span className={blanksReady ? "text-green-700" : "text-brand-700"}>{blanksReady ? "Blanks in" : "Waiting on blanks"}</span>
        <span className={o.proofs.length ? "text-green-700" : "text-gray-500"}>{o.proofs.length ? "Art approved" : "No approved proof"}</span>
      </div>
      <ol className="flex flex-wrap gap-1" aria-label="Steps">
        {job.steps.map((s) => (
          <li key={s.id}>
            <ActionButton
              action={stepAction}
              fields={{ stepId: s.id, done: s.doneAt ? "0" : "1" }}
              className={`rounded border px-2 py-0.5 text-xs ${s.doneAt ? "border-green-300 bg-green-50 text-green-800" : s.id === next?.id ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white text-gray-600"}`}
              label={<>{s.doneAt ? "✓ " : ""}{s.name}</>}
              title={s.doneAt ? "Click to undo" : "Mark done"}
            />
          </li>
        ))}
      </ol>
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500">
          {job.assignedTo ? `Assigned to ${job.assignedTo.name}` : "Unassigned"}{job.notes ? ` · ${job.notes}` : ""} · <a href={`/admin/print/work-order/${o.id}`} target="_blank" className="text-brand-700 hover:underline">Work order</a>
        </summary>
        <ActionForm action={assignJobAction} className="mt-2 space-y-2">
          <input type="hidden" name="jobId" value={job.id} />
          <select className="input" name="assignedToId" defaultValue={job.assignedToId ?? ""} aria-label="Assigned to">
            <option value="">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" name="notes" defaultValue={job.notes ?? ""} placeholder="Note for the floor" aria-label="Note" />
        </ActionForm>
      </details>
    </div>
  );
}
