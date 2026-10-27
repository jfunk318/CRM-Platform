import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bucketOf, dueLabel, taskInclude } from "@/lib/crm/tasks";
import { orderRef } from "@/lib/orders/numbers";
import { createTaskAction, deleteTaskAction, toggleTaskAction } from "@/app/admin/(panel)/tasks/actions";
import { ActionButton } from "./action-button";
import { ActionForm } from "./action-form";
import { DueDateInput } from "./due-date-input";

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type Link_ = { leadId?: string; customerId?: string; orderId?: string };

const DUE_CLASS = { overdue: "text-red-600 font-medium", today: "text-amber-700 font-medium", upcoming: "text-gray-600", someday: "text-gray-400", done: "text-gray-400" } as const;

/** What a task is about, as a link (left out on that record's own page). */
function about(t: TaskRow, here: Link_) {
  if (t.lead && here.leadId !== t.lead.id) return { href: `/admin/leads/${t.lead.id}`, label: `${t.lead.firstName} ${t.lead.lastName}`.trim() + (t.lead.organization ? ` (${t.lead.organization})` : "") };
  if (t.order && here.orderId !== t.order.id) return { href: `/admin/orders/${t.order.id}`, label: `${t.order.type === "QUOTE" ? "Quote" : "Order"} ${orderRef(t.order)}` };
  if (t.customer && here.customerId !== t.customer.id) return { href: `/admin/customers/${t.customer.id}`, label: `${t.customer.firstName} ${t.customer.lastName}`.trim() };
  return null;
}

/** Tasks with a tick box each; done ones are greyed out. */
export function TaskList({ tasks, here = {}, showAssignee = true }: { tasks: TaskRow[]; here?: Link_; showAssignee?: boolean }) {
  return (
    <ul className="divide-y divide-gray-100" data-testid="task-list">
      {tasks.map((t) => {
        const bucket = bucketOf(t);
        const link = about(t, here);
        return (
          <li key={t.id} className="flex items-start gap-2 py-2 text-sm" data-testid="task">
            <ActionButton
              action={toggleTaskAction}
              fields={{ id: t.id, done: t.doneAt ? "0" : "1" }}
              label={t.doneAt ? "☑" : "☐"}
              title={t.doneAt ? "Mark not done" : "Mark done"}
              className="text-lg leading-5 text-gray-500 hover:text-amber-700"
            />
            <div className="min-w-0 flex-1">
              <div className={t.doneAt ? "text-gray-400 line-through" : "font-medium"}>{t.title}</div>
              <div className="flex flex-wrap gap-x-2 text-xs">
                <span className={DUE_CLASS[bucket]}>{t.doneAt ? "Done" : dueLabel(t.dueDate)}</span>
                {link && <Link href={link.href} className="text-amber-700 hover:underline">{link.label}</Link>}
                {showAssignee && <span className="text-gray-500">{t.assignee?.name ?? "Unassigned"}</span>}
              </div>
              {t.notes && <p className="whitespace-pre-wrap text-xs text-gray-600">{t.notes}</p>}
            </div>
            <ActionButton action={deleteTaskAction} fields={{ id: t.id }} label="✕" title="Delete task" confirm="Delete this task?" className="text-xs text-gray-300 hover:text-red-600" />
          </li>
        );
      })}
    </ul>
  );
}

/** The add-task form; `link` ties the task to the record it's on. */
export function TaskForm({ link = {}, staff, me, compact }: { link?: Link_; staff: { id: string; name: string }[]; me: string; compact?: boolean }) {
  return (
    <ActionForm action={createTaskAction} submitLabel="Add task" resetOnSuccess className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-[1fr_12rem_12rem] sm:items-start"}>
      {Object.entries(link).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <div>
        <label className="label" htmlFor={`task-title-${compact ? "c" : "f"}`}>Task</label>
        <input className="input" id={`task-title-${compact ? "c" : "f"}`} name="title" placeholder="Call back about sizes" required />
      </div>
      <div>
        <label className="label" htmlFor={`task-due-${compact ? "c" : "f"}`}>Due</label>
        <DueDateInput id={`task-due-${compact ? "c" : "f"}`} />
      </div>
      <div>
        <label className="label" htmlFor={`task-who-${compact ? "c" : "f"}`}>For</label>
        <select className="input" id={`task-who-${compact ? "c" : "f"}`} name="assigneeId" defaultValue={me}>
          <option value="">Anyone</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    </ActionForm>
  );
}

/** A record's open tasks (and recently done ones) with a form to add more. */
export function TasksCard({ tasks, link, staff, me }: { tasks: TaskRow[]; link: Link_; staff: { id: string; name: string }[]; me: string }) {
  const open = tasks.filter((t) => !t.doneAt);
  const done = tasks.filter((t) => t.doneAt).slice(0, 5);
  return (
    <section className="card space-y-2" data-testid="tasks-card">
      <h2 className="font-semibold">Tasks{open.length > 0 && <span className="ml-1 text-sm font-normal text-gray-500">({open.length} open)</span>}</h2>
      {open.length > 0 ? <TaskList tasks={open} here={link} /> : <p className="text-sm text-gray-500">Nothing to do.</p>}
      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500">Done ({done.length})</summary>
          <TaskList tasks={done} here={link} />
        </details>
      )}
      <details className="border-t border-gray-100 pt-2">
        <summary className="cursor-pointer text-sm font-medium text-amber-700">+ Add a task</summary>
        <div className="mt-2">
          <TaskForm link={link} staff={staff} me={me} compact />
        </div>
      </details>
    </section>
  );
}
