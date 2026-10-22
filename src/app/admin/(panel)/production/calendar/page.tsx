import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { orderRef } from "@/lib/orders/numbers";
import { jobPieces } from "@/lib/production/jobs";
import { addDays, dayKey, parseDay, today } from "@/lib/production/defaults";
import { ActionForm } from "@/components/admin/action-form";
import { autoScheduleAction } from "../actions";
import { type CalendarJob, CalendarBoard } from "./calendar-board";

const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Monday of the week containing `d`. */
const mondayOf = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { db } = await requireStaff(["PRODUCTION"]);
  const { week } = await searchParams;
  const now = today();
  const start = mondayOf(parseDay(week) ?? now);
  const end = addDays(start, 5);
  const days = Array.from({ length: 5 }, (_, i) => addDays(start, i));

  const [jobs, methods] = await Promise.all([
    db.productionJob.findMany({
      where: {
        order: { status: { isClosed: false } },
        OR: [
          { scheduledFor: { gte: start, lt: end } },
          { scheduledFor: null, status: { not: "DONE" } },
          { scheduledFor: { lt: start }, status: { not: "DONE" } },
        ],
      },
      include: { method: true, steps: { orderBy: { sortOrder: "asc" } }, order: { include: { customer: true } } },
      orderBy: [{ order: { rush: "desc" } }, { order: { dueDate: { sort: "asc", nulls: "last" } } }],
    }),
    db.decorationMethod.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const pieces = await jobPieces(db, jobs);

  const data: CalendarJob[] = jobs.map((j) => ({
    id: j.id,
    orderId: j.orderId,
    ref: orderRef(j.order),
    customer: `${j.order.customer.firstName} ${j.order.customer.lastName}`,
    method: j.method.name,
    methodId: j.methodId,
    pieces: pieces.get(j.id) ?? 0,
    day: j.scheduledFor ? dayKey(j.scheduledFor) : null,
    due: j.order.dueDate ? short(j.order.dueDate) : null,
    late: !!j.order.dueDate && j.order.dueDate < now && j.status !== "DONE",
    rush: j.order.rush,
    done: j.status === "DONE",
    step: j.steps.find((s) => !s.doneAt)?.name ?? null,
    behind: !!j.scheduledFor && j.scheduledFor < start,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/production" className="text-sm text-amber-700 hover:underline">← Production</Link>
          <h1 className="page-title mt-1">Week of {short(start)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href={`/admin/production/calendar?week=${dayKey(addDays(start, -7))}`}>← Previous</Link>
          <Link className="btn-secondary" href="/admin/production/calendar">This week</Link>
          <Link className="btn-secondary" href={`/admin/production/calendar?week=${dayKey(addDays(start, 7))}`}>Next →</Link>
          <ActionForm action={autoScheduleAction} submitLabel="Auto-schedule" className="flex items-center gap-2">
            {null}
          </ActionForm>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Auto-schedule puts unscheduled jobs on the earliest days with room, rush and earliest due first. Set each
        method&apos;s daily capacity on its <Link href="/admin/methods" className="text-amber-700 hover:underline">decoration method</Link> page.
      </p>
      <CalendarBoard
        days={days.map((d) => ({
          key: dayKey(d),
          label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
          isToday: d.getTime() === now.getTime(),
        }))}
        jobs={data}
        capacities={methods.map((m) => ({ methodId: m.id, name: m.shortName || m.name, capacity: m.dailyCapacity }))}
      />
    </div>
  );
}
