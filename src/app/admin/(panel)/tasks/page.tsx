import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { BUCKET_LABELS, bucketOf, type TaskBucket, taskInclude } from "@/lib/crm/tasks";
import { TaskForm, TaskList } from "@/components/admin/tasks";

export const metadata = { title: "Tasks" };

const VIEWS = { mine: "Mine", everyone: "Everyone's", unassigned: "Unassigned" } as const;
type View = keyof typeof VIEWS;

/** Follow-ups to do: overdue, today, coming up, undated, and recently done. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const staff = await requireStaff();
  const { db } = staff;
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "mine";
  const who: Prisma.TaskWhereInput = view === "mine" ? { assigneeId: staff.id } : view === "unassigned" ? { assigneeId: null } : {};
  const [open, done, staffList] = await Promise.all([
    db.task.findMany({ where: { ...who, doneAt: null }, include: taskInclude, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: 500 }),
    db.task.findMany({ where: { ...who, doneAt: { not: null } }, include: taskInclude, orderBy: { doneAt: "desc" }, take: 20 }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const groups: TaskBucket[] = ["overdue", "today", "upcoming", "someday"];

  return (
    <div className="space-y-5">
      <h1 className="page-title">Tasks</h1>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Whose tasks">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={v === "mine" ? "/admin/tasks" : `/admin/tasks?view=${v}`} className={`rounded-full border px-3 py-1 ${view === v ? "border-amber-500 bg-amber-50 font-medium" : "border-gray-200 bg-white hover:border-amber-300"}`}>
            {VIEWS[v]}
          </Link>
        ))}
      </nav>

      <section className="card">
        <TaskForm staff={staffList} me={view === "unassigned" ? "" : staff.id} />
      </section>

      {open.length === 0 && <p className="text-sm text-gray-500">Nothing to do{view === "mine" ? " for you" : ""}. 🎉</p>}
      {groups.map((g) => {
        const list = open.filter((t) => bucketOf(t) === g);
        if (list.length === 0) return null;
        return (
          <section key={g} className="card space-y-1" data-testid={`tasks-${g}`}>
            <h2 className={`font-semibold ${g === "overdue" ? "text-red-600" : ""}`}>
              {BUCKET_LABELS[g]} <span className="text-sm font-normal text-gray-500">({list.length})</span>
            </h2>
            <TaskList tasks={list} showAssignee={view !== "mine"} />
          </section>
        );
      })}
      {done.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Recently done</summary>
          <TaskList tasks={done} showAssignee={view !== "mine"} />
        </details>
      )}
    </div>
  );
}
