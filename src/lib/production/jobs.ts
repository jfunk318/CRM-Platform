import "server-only";
import type { DecorationMethod, Prisma } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { logEvent, moveToRole, OrderError } from "@/lib/orders/service";
import { addDays, dayKey, DEFAULT_WORKFLOW_STEPS, nextWorkday, today } from "./defaults";

/** Lines with what's needed to work out each method's pieces and placements. */
export const jobLinesInclude = {
  lines: {
    orderBy: { sortOrder: "asc" },
    include: {
      sizes: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } },
      names: { include: { size: true }, orderBy: { sortOrder: "asc" } },
      design: { include: { product: true, color: true, decorations: { orderBy: { sortOrder: "asc" } } } },
    },
  },
} satisfies Prisma.OrderInclude;

type JobLines = Prisma.OrderGetPayload<{ include: typeof jobLinesInclude }>["lines"];

/** What a method has to decorate on an order: pieces and placements per line. */
export function methodWork(lines: JobLines, methodId: string) {
  const items = lines
    .map((l) => ({
      line: l,
      decorations: l.design.decorations.filter((d) => d.methodId === methodId),
      pieces: l.sizes.reduce((n, s) => n + s.qty, 0),
    }))
    .filter((i) => i.decorations.length > 0);
  return { items, pieces: items.reduce((n, i) => n + i.pieces, 0) };
}

/** The methods an order's lines use, in first-seen order. */
export function methodsUsed(lines: JobLines): string[] {
  const ids: string[] = [];
  for (const l of lines) for (const d of l.design.decorations) if (!ids.includes(d.methodId)) ids.push(d.methodId);
  return ids;
}

async function stepsFor(tx: BusinessTx, method: DecorationMethod): Promise<string[]> {
  const steps = await tx.workflowStep.findMany({ where: { methodId: method.id }, orderBy: { sortOrder: "asc" } });
  return steps.length ? steps.map((s) => s.name) : DEFAULT_WORKFLOW_STEPS[method.kind];
}

/**
 * Create a production job for each decoration method on the order that
 * doesn't have one yet. Returns how many were created.
 */
export async function createProductionJobs(db: BusinessDb | BusinessTx, orderId: string, staffId: string | null): Promise<number> {
  const businessId = db.$businessId;
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { ...jobLinesInclude, productionJobs: true, status: true },
  });
  if (order.type !== "ORDER") throw new OrderError("Only orders go into production");
  if (order.status.isClosed) throw new OrderError("This order is closed");
  const missing = methodsUsed(order.lines).filter((m) => !order.productionJobs.some((j) => j.methodId === m));
  if (missing.length === 0) return 0;
  const methods = await db.decorationMethod.findMany({ where: { id: { in: missing } } });
  const names: string[] = [];
  for (const method of methods) {
    const steps = await stepsFor(db, method);
    await db.productionJob.create({
      data: {
        businessId,
        orderId,
        methodId: method.id,
        steps: { create: steps.map((name, i) => ({ name, sortOrder: i })) },
      },
    });
    names.push(method.name);
  }
  await logEvent(db, businessId, orderId, "PRODUCTION", `Production jobs created: ${names.join(", ")}`, staffId);
  return methods.length;
}

/** Remove a job, e.g. after its method was taken off the order. */
export async function removeJob(db: BusinessDb, jobId: string, staffId: string | null): Promise<void> {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { method: true } });
  await db.productionJob.delete({ where: { id: jobId } });
  await logEvent(db, db.$businessId, job.orderId, "PRODUCTION", `Removed the ${job.method.name} job`, staffId);
}

/** Tick a step done (or undo it); the job and order follow. */
export async function setStepDone(db: BusinessDb, stepId: string, done: boolean, staffId: string | null): Promise<void> {
  const businessId = db.$businessId;
  await db.$transaction(async (tx) => {
    const step = await tx.productionJobStep.findUniqueOrThrow({ where: { id: stepId }, include: { job: { include: { method: true } } } });
    if (!!step.doneAt === done) return;
    await tx.productionJobStep.update({
      where: { id: stepId },
      data: done ? { doneAt: new Date(), doneById: staffId } : { doneAt: null, doneById: null },
    });
    const steps = await tx.productionJobStep.findMany({ where: { jobId: step.jobId } });
    const doneCount = steps.filter((s) => s.doneAt).length;
    const status = doneCount === 0 ? "QUEUED" : doneCount === steps.length ? "DONE" : "IN_PROGRESS";
    const job = step.job;
    await tx.productionJob.update({
      where: { id: job.id },
      data: {
        status,
        startedAt: job.startedAt ?? (doneCount > 0 ? new Date() : null),
        completedAt: status === "DONE" ? new Date() : null,
      },
    });
    const orderId = job.orderId;
    await logEvent(tx, businessId, orderId, "PRODUCTION", `${job.method.name}: ${step.name} ${done ? "done" : "undone"}`, staffId);
    if (done) await moveToRole(tx, businessId, orderId, "ORDER_IN_PRODUCTION", staffId, "production started", { forwardOnly: true });
    if (status === "DONE") {
      const open = await tx.productionJob.count({ where: { orderId, status: { not: "DONE" } } });
      if (open === 0) await moveToRole(tx, businessId, orderId, "ORDER_READY", staffId, "production finished", { forwardOnly: true });
    }
  });
}

export async function scheduleJob(db: BusinessDb, jobId: string, day: Date | null, staffId: string | null): Promise<void> {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { method: true } });
  if (job.scheduledFor?.getTime() === day?.getTime()) return;
  await db.productionJob.update({ where: { id: jobId }, data: { scheduledFor: day } });
  await logEvent(
    db,
    db.$businessId,
    job.orderId,
    "PRODUCTION",
    day ? `${job.method.name} scheduled for ${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}` : `${job.method.name} unscheduled`,
    staffId,
  );
}

export async function assignJob(db: BusinessDb, jobId: string, assigneeId: string | null, notes: string | null): Promise<void> {
  if (assigneeId) await db.staffUser.findUniqueOrThrow({ where: { id: assigneeId } });
  await db.productionJob.update({ where: { id: jobId }, data: { assignedToId: assigneeId, notes } });
}

/** Pieces each open job has to decorate, keyed by job id. */
export async function jobPieces(db: BusinessDb, jobs: { id: string; orderId: string; methodId: string }[]): Promise<Map<string, number>> {
  const orders = await db.order.findMany({ where: { id: { in: [...new Set(jobs.map((j) => j.orderId))] } }, include: jobLinesInclude });
  const byId = new Map(orders.map((o) => [o.id, o]));
  return new Map(jobs.map((j) => [j.id, methodWork(byId.get(j.orderId)?.lines ?? [], j.methodId).pieces]));
}

/**
 * Put unscheduled jobs on the calendar: rush and earliest-due first, each on
 * the first workday from `from` where its method still has capacity
 * (methods without a daily capacity take everything on the first day).
 */
export async function autoSchedule(db: BusinessDb, staffId: string | null, from = today()): Promise<number> {
  const start = nextWorkday(from);
  const jobs = await db.productionJob.findMany({
    where: { status: { not: "DONE" }, order: { status: { isClosed: false } } },
    include: { method: true, order: true },
  });
  const pieces = await jobPieces(db, jobs);
  // Load already on the calendar, per method per day.
  const load = new Map<string, number>();
  const key = (methodId: string, d: Date) => `${methodId}:${dayKey(d)}`;
  for (const j of jobs) if (j.scheduledFor) load.set(key(j.methodId, j.scheduledFor), (load.get(key(j.methodId, j.scheduledFor)) ?? 0) + (pieces.get(j.id) ?? 0));

  const todo = jobs
    .filter((j) => !j.scheduledFor)
    .sort((a, b) => Number(b.order.rush) - Number(a.order.rush) || (a.order.dueDate?.getTime() ?? Infinity) - (b.order.dueDate?.getTime() ?? Infinity));
  for (const j of todo) {
    const n = pieces.get(j.id) ?? 0;
    const cap = j.method.dailyCapacity;
    let d = start;
    // A job bigger than a whole day goes on the first empty day.
    for (let i = 0; i < 260 && cap; i++, d = nextWorkday(addDays(d, 1))) {
      const used = load.get(key(j.methodId, d)) ?? 0;
      if (used + n <= cap || used === 0) break;
    }
    load.set(key(j.methodId, d), (load.get(key(j.methodId, d)) ?? 0) + n);
    await db.productionJob.update({ where: { id: j.id }, data: { scheduledFor: d } });
    await logEvent(db, db.$businessId, j.orderId, "PRODUCTION", `${j.method.name} scheduled for ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} (auto)`, staffId);
  }
  return todo.length;
}

