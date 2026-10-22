"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, FormError, optionalText, runAction, text } from "@/lib/admin/form";
import { OrderError } from "@/lib/orders/service";
import { parseDay } from "@/lib/production/defaults";
import { assignJob, autoSchedule, createProductionJobs, removeJob, scheduleJob, setStepDone } from "@/lib/production/jobs";

function refresh(orderId?: string) {
  revalidatePath("/admin/production");
  revalidatePath("/admin/production/calendar");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OrderError) throw new FormError(e.message);
      throw e;
    }
  });
}

export async function createJobsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PRODUCTION", "SALES"]);
  const orderId = text(form, "orderId");
  return run(async () => {
    const n = await createProductionJobs(staff.db, orderId, staff.id);
    refresh(orderId);
    return n ? `Created ${n} job${n === 1 ? "" : "s"}` : "Every method already has a job";
  });
}

export async function removeJobAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PRODUCTION"]);
  return run(async () => {
    const job = await staff.db.productionJob.findUniqueOrThrow({ where: { id: text(form, "jobId") } });
    await removeJob(staff.db, job.id, staff.id);
    refresh(job.orderId);
    return "Removed";
  });
}

export async function stepAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PRODUCTION"]);
  return run(async () => {
    const step = await staff.db.productionJobStep.findUniqueOrThrow({ where: { id: text(form, "stepId") }, include: { job: true } });
    await setStepDone(staff.db, step.id, form.get("done") === "1", staff.id);
    refresh(step.job.orderId);
  });
}

export async function scheduleAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PRODUCTION"]);
  return run(async () => {
    const raw = optionalText(form, "day");
    const day = parseDay(raw);
    if (raw && !day) throw new FormError("Choose a date");
    const job = await staff.db.productionJob.findUniqueOrThrow({ where: { id: text(form, "jobId") } });
    await scheduleJob(staff.db, job.id, day, staff.id);
    refresh(job.orderId);
    return day ? "Scheduled" : "Unscheduled";
  });
}

/** Called directly by the calendar when a job is dragged to another day. */
export async function moveJob(jobId: string, day: string | null): Promise<ActionResult> {
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("day", day ?? "");
  return scheduleAction({}, form);
}

export async function assignJobAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PRODUCTION"]);
  return run(async () => {
    const job = await staff.db.productionJob.findUniqueOrThrow({ where: { id: text(form, "jobId") } });
    await assignJob(staff.db, job.id, optionalText(form, "assignedToId"), optionalText(form, "notes"));
    refresh(job.orderId);
  });
}

export async function autoScheduleAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  void form;
  const staff = await requireStaff(["PRODUCTION"]);
  return run(async () => {
    const n = await autoSchedule(staff.db, staff.id);
    refresh();
    return n ? `Scheduled ${n} job${n === 1 ? "" : "s"}` : "Nothing waiting to be scheduled";
  });
}
