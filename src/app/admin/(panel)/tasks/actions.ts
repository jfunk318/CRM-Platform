"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, FormError, optionalText, runAction, text } from "@/lib/admin/form";
import { createTask, setTaskDone, TaskError, updateTask } from "@/lib/crm/tasks";

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof TaskError) throw new FormError(e.message);
      throw e;
    }
  });
}

/** Tasks show on several pages; refresh them all. */
const refresh = () => revalidatePath("/admin", "layout");

function dueDate(form: FormData): Date | null {
  const raw = optionalText(form, "dueDate");
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new FormError("Due date must be a date");
  return new Date(`${raw}T00:00:00Z`);
}

export async function createTaskAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  return run(async () => {
    await createTask(
      staff.db,
      {
        title: text(form, "title", "Task"),
        notes: optionalText(form, "notes"),
        dueDate: dueDate(form),
        assigneeId: optionalText(form, "assigneeId"),
        leadId: optionalText(form, "leadId"),
        customerId: optionalText(form, "customerId"),
        orderId: optionalText(form, "orderId"),
      },
      staff.id,
    );
    refresh();
    return "Task added";
  });
}

export async function saveTaskAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  return run(async () => {
    await updateTask(staff.db, text(form, "id"), { title: text(form, "title", "Task"), notes: optionalText(form, "notes"), dueDate: dueDate(form), assigneeId: optionalText(form, "assigneeId") });
    refresh();
  });
}

export async function toggleTaskAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  return run(async () => {
    await setTaskDone(staff.db, text(form, "id"), form.get("done") === "1", staff.id);
    refresh();
  });
}

export async function deleteTaskAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  return run(async () => {
    await staff.db.task.delete({ where: { id: text(form, "id") } });
    refresh();
  });
}
