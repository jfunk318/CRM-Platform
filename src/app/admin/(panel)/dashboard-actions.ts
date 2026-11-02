"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, checkbox, FormError, optionalText, runAction, text } from "@/lib/admin/form";
import { chooseDashboard, DashboardError, deleteTemplate, saveMyDashboard, saveTemplate, setBusinessDefault } from "@/lib/dashboard/layouts";
import { isSection, type LayoutItem, parseLayout, type Section, SECTIONS } from "@/lib/dashboard/widgets";
import { createOrder, OrderError } from "@/lib/orders/service";

/** Dashboard errors are user-facing. */
const run = (fn: () => Promise<string | void>) =>
  runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof DashboardError || e instanceof OrderError) throw new FormError(e.message);
      throw e;
    }
  });

const sectionFrom = (form: FormData): Section => {
  const s = form.get("section");
  if (!isSection(s)) throw new FormError("Which dashboard?");
  return s;
};
const refresh = (section: Section) => revalidatePath(SECTIONS[section].path);

const layoutFrom = (form: FormData): LayoutItem[] => {
  try {
    return parseLayout(JSON.parse(String(form.get("layout") ?? "[]")));
  } catch {
    throw new FormError("The dashboard couldn't be read; try again");
  }
};

/** The dashboard's Create a quote. */
export async function createQuoteAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  let id = "";
  const result = await run(async () => {
    const customerId = optionalText(form, "customerId");
    if (!customerId) throw new FormError("Choose a customer");
    id = await createOrder(staff.db, { type: "QUOTE", customerId, staffId: staff.id, title: optionalText(form, "title") });
    if (checkbox(form, "forStore")) await staff.db.order.update({ where: { id }, data: { forStore: true } });
  });
  if (result.error) return result;
  redirect(`/admin/orders/${id}`);
}

export async function saveMyDashboardAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  return run(async () => {
    const section = sectionFrom(form);
    await saveMyDashboard(staff.db, staff.id, section, layoutFrom(form));
    refresh(section);
    return "Saved as your dashboard";
  });
}

export async function saveTemplateAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["ADMIN"]);
  return run(async () => {
    const section = sectionFrom(form);
    const id = await saveTemplate(staff.db, section, text(form, "name", "Template name"), layoutFrom(form));
    if (checkbox(form, "makeDefault")) await setBusinessDefault(staff.db, section, id);
    refresh(section);
    return checkbox(form, "makeDefault") ? "Saved as a template and made everyone's default" : "Saved as a template everyone can use";
  });
}

export async function chooseDashboardAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  return run(async () => {
    const section = sectionFrom(form);
    await chooseDashboard(staff.db, staff.id, section, optionalText(form, "layoutId"));
    refresh(section);
    return "Switched";
  });
}

export async function setDefaultDashboardAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["ADMIN"]);
  return run(async () => {
    const section = sectionFrom(form);
    await setBusinessDefault(staff.db, section, optionalText(form, "layoutId"));
    refresh(section);
    return "Default updated";
  });
}

export async function deleteTemplateAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["ADMIN"]);
  return run(async () => {
    const section = sectionFrom(form);
    await deleteTemplate(staff.db, text(form, "layoutId"));
    refresh(section);
    return "Template deleted";
  });
}
