"use server";

import type { LeadStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, checkbox, FormError, optionalDecimal, optionalText, runAction, text } from "@/lib/admin/form";
import { CONTACT_TYPES, convertLead, createLead, LEAD_STATUS_LABELS, LeadError, type LeadInput, logContact, possibleDuplicates, updateLead } from "@/lib/crm/leads";

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof LeadError) throw new FormError(e.message);
      throw e;
    }
  });
}

const refresh = (id?: string) => {
  revalidatePath("/admin/leads");
  if (id) revalidatePath(`/admin/leads/${id}`);
};

function leadInput(form: FormData): LeadInput {
  return {
    firstName: text(form, "firstName", "First name"),
    lastName: optionalText(form, "lastName") ?? "",
    organization: optionalText(form, "organization"),
    title: optionalText(form, "title"),
    email: optionalText(form, "email"),
    phone: optionalText(form, "phone"),
    source: optionalText(form, "source"),
    interest: optionalText(form, "interest"),
    estimatedValue: optionalDecimal(String(form.get("estimatedValue") ?? "").replace(/[$,]/g, ""), "Estimated value"),
    ownerId: optionalText(form, "ownerId"),
  };
}

export async function createLeadAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  let id = "";
  const r = await run(async () => {
    const input = leadInput(form);
    if (!checkbox(form, "addAnyway")) {
      const dupes = await possibleDuplicates(staff.db, { email: input.email?.toLowerCase() ?? null, phone: input.phone });
      const found = [
        ...dupes.customers.map((c) => `customer ${c.firstName} ${c.lastName}`.trim() + (c.company ? ` (${c.company.name})` : "")),
        ...dupes.leads.map((l) => `lead ${l.firstName} ${l.lastName}`.trim() + (l.organization ? ` (${l.organization})` : "")),
      ];
      if (found.length) throw new FormError(`Already on file with that email or phone: ${found.join("; ")}. Tick "Add anyway" to add them as a new lead.`);
    }
    id = await createLead(staff.db, input, staff.id);
    refresh();
  });
  if (r.error) return r;
  redirect(`/admin/leads/${id}`);
}

export async function saveLeadAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  return run(async () => {
    const id = text(form, "id");
    const status = String(form.get("status") ?? "") as LeadStatus;
    if (!(status in LEAD_STATUS_LABELS)) throw new FormError("Choose a status");
    await updateLead(staff.db, id, { ...leadInput(form), status, lostReason: optionalText(form, "lostReason") }, staff.id);
    refresh(id);
  });
}

export async function logContactAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  return run(async () => {
    const id = text(form, "id");
    const type = String(form.get("type") ?? "NOTE");
    if (!(type in CONTACT_TYPES)) throw new FormError("Choose what kind of contact it was");
    await logContact(staff.db, id, type as keyof typeof CONTACT_TYPES, String(form.get("body") ?? ""), staff.id);
    refresh(id);
  });
}

export async function convertLeadAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  let to = "";
  const r = await run(async () => {
    const id = text(form, "id");
    const done = await convertLead(staff.db, id, { makeQuote: checkbox(form, "makeQuote") }, staff.id);
    to = done.quoteId && checkbox(form, "makeQuote") ? `/admin/orders/${done.quoteId}` : `/admin/customers/${done.customerId}`;
    refresh(id);
    revalidatePath("/admin/customers");
  });
  if (r.error) return r;
  redirect(to);
}

export async function deleteLeadAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  const r = await run(async () => {
    await db.lead.delete({ where: { id: text(form, "id") } });
    refresh();
  });
  if (r.error) return r;
  redirect("/admin/leads");
}
