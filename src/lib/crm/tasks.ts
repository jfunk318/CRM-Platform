import "server-only";
import type { Task } from "@prisma/client";
import { type BusinessDb, forBusiness, prisma } from "@/lib/db";
import { orderRef } from "@/lib/orders/numbers";
import { today } from "@/lib/production/defaults";
import { logLeadEvent } from "./leads";

export class TaskError extends Error {}

export type TaskInput = {
  title: string;
  notes: string | null;
  dueDate: Date | null;
  assigneeId: string | null;
  leadId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
};

export type TaskBucket = "overdue" | "today" | "upcoming" | "someday" | "done";
export const BUCKET_LABELS: Record<TaskBucket, string> = { overdue: "Overdue", today: "Today", upcoming: "Coming up", someday: "No due date", done: "Done" };

/** Where a task falls on a to-do list. */
export function bucketOf(t: Pick<Task, "dueDate" | "doneAt">, day = today()): TaskBucket {
  if (t.doneAt) return "done";
  if (!t.dueDate) return "someday";
  const d = t.dueDate.getTime();
  return d < day.getTime() ? "overdue" : d === day.getTime() ? "today" : "upcoming";
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

/** "Today", "Tomorrow", "Thu, Oct 30", "Overdue · Oct 20". */
export function dueLabel(due: Date | null, day = today()): string {
  if (!due) return "No due date";
  const diff = Math.round((due.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `Overdue · ${fmt(due, { month: "short", day: "numeric" })}`;
  return fmt(due, diff < 7 ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
}

function checked(input: TaskInput) {
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 200);
  if (!title) throw new TaskError("Say what needs doing");
  return { ...input, title, notes: input.notes?.trim().slice(0, 4000) || null };
}

/** The lead's timeline mentions its tasks. */
const dueText = (d: Date | null) => (d ? ` (due ${fmt(d, { month: "short", day: "numeric" })})` : "");

export async function createTask(db: BusinessDb, input: TaskInput, staffId: string | null, autoKey?: string): Promise<string> {
  const data = checked(input);
  // Linked records must be this business's (the scoped client only finds its own).
  if (data.leadId && !(await db.lead.findUnique({ where: { id: data.leadId } }))) throw new TaskError("That lead isn't available");
  if (data.customerId && !(await db.customer.findUnique({ where: { id: data.customerId } }))) throw new TaskError("That customer isn't available");
  if (data.orderId && !(await db.order.findUnique({ where: { id: data.orderId } }))) throw new TaskError("That quote or order isn't available");
  return db.$transaction(async (tx) => {
    const task = await tx.task.create({ data: { ...data, businessId: db.$businessId, createdById: staffId, autoKey } });
    if (data.leadId) await logLeadEvent(tx, data.leadId, "NOTE", `Task: ${data.title}${dueText(data.dueDate)}`, staffId);
    return task.id;
  });
}

export async function updateTask(db: BusinessDb, id: string, input: Omit<TaskInput, "leadId" | "customerId" | "orderId">) {
  const data = checked(input);
  await db.task.update({ where: { id }, data: { title: data.title, notes: data.notes, dueDate: data.dueDate, assigneeId: data.assigneeId } });
}

/** Tick a task done (or not); a lead's timeline notes it. */
export async function setTaskDone(db: BusinessDb, id: string, done: boolean, staffId: string | null) {
  const task = await db.task.findUniqueOrThrow({ where: { id } });
  if (!!task.doneAt === done) return;
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: done ? { doneAt: new Date(), doneById: staffId } : { doneAt: null, doneById: null } });
    if (task.leadId && done) await logLeadEvent(tx, task.leadId, "NOTE", `Done: ${task.title}`, staffId);
  });
}

/** Open tasks of mine due today or earlier, for the menu's count. */
export const dueTaskCount = (db: BusinessDb, staffId: string, day = today()) => db.task.count({ where: { assigneeId: staffId, doneAt: null, dueDate: { lte: day } } });

export const taskInclude = {
  assignee: { select: { id: true, name: true } },
  lead: { select: { id: true, firstName: true, lastName: true, organization: true } },
  customer: { select: { id: true, firstName: true, lastName: true } },
  order: { select: { id: true, type: true, number: true } },
} as const;

/**
 * Follow-up tasks for quotes emailed `quoteFollowUpDays` ago that are still
 * waiting for an answer: one per sending, for whoever has the quote.
 */
export async function createQuoteFollowUps(db: BusinessDb, now = new Date()): Promise<number> {
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  if (!business.quoteFollowUpDays) return 0;
  const cutoff = new Date(now.getTime() - business.quoteFollowUpDays * 86_400_000);
  const quotes = await db.order.findMany({
    where: { type: "QUOTE", status: { role: "QUOTE_SENT" } },
    include: { customer: true, events: { where: { type: "EMAIL", body: { startsWith: "Quote emailed" } }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  let made = 0;
  for (const q of quotes) {
    const sent = q.events[0];
    if (!sent || sent.createdAt > cutoff) continue;
    const autoKey = `quote-follow-up:${sent.id}`;
    if (await db.task.findFirst({ where: { autoKey } })) continue;
    await createTask(
      db,
      {
        title: `Follow up on quote ${orderRef(q)} for ${`${q.customer.firstName} ${q.customer.lastName}`.trim()}`,
        notes: `Emailed ${business.quoteFollowUpDays} day${business.quoteFollowUpDays === 1 ? "" : "s"} ago with no answer yet.`,
        dueDate: today(),
        assigneeId: q.assignedToId ?? q.createdById,
        customerId: q.customerId,
        orderId: q.id,
      },
      null,
      autoKey,
    );
    made++;
  }
  return made;
}

/** Quote follow-ups for every active business (run hourly). */
export async function runFollowUps(now = new Date()): Promise<number> {
  const businesses = await prisma.business.findMany({ where: { status: "ACTIVE", quoteFollowUpDays: { not: null } }, select: { id: true } });
  let made = 0;
  for (const b of businesses) made += await createQuoteFollowUps(forBusiness(b.id), now);
  return made;
}

