"use server";

import type { AutomationTrigger } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, checkbox, FormError, runAction, text } from "@/lib/admin/form";
import { checkRule, RuleError } from "@/lib/automation/manage";
import { TRIGGERS } from "@/lib/automation/rules";

const json = (form: FormData, name: string) => {
  try {
    return JSON.parse(String(form.get(name) ?? "null"));
  } catch {
    throw new FormError("The form didn't send its settings; reload and try again");
  }
};

export async function saveRuleAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  const id = String(form.get("id") ?? "");
  let created = "";
  const r = await runAction(async () => {
    const trigger = text(form, "trigger") as AutomationTrigger;
    if (!(trigger in TRIGGERS)) throw new FormError("Choose when the rule runs");
    let data;
    try {
      data = await checkRule(db, { name: text(form, "name", "Name"), trigger, conditions: json(form, "conditions"), actions: json(form, "actions") });
    } catch (e) {
      if (e instanceof RuleError) throw new FormError(e.message);
      throw e;
    }
    const active = checkbox(form, "active");
    if (id) await db.automationRule.update({ where: { id }, data: { ...data, active } });
    else created = (await db.automationRule.create({ data: { ...data, active, businessId: db.$businessId } })).id;
    revalidatePath("/admin/automations");
  });
  if (r.error || !created) return r;
  redirect(`/admin/automations/${created}`);
}

export async function toggleRuleAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const rule = await db.automationRule.findUniqueOrThrow({ where: { id: text(form, "id") } });
    await db.automationRule.update({ where: { id: rule.id }, data: { active: !rule.active } });
    revalidatePath("/admin/automations");
    return rule.active ? "Turned off" : "Turned on";
  });
}

export async function deleteRuleAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  const r = await runAction(async () => {
    await db.automationRule.delete({ where: { id: text(form, "id") } });
    revalidatePath("/admin/automations");
  });
  if (r.error) return r;
  redirect("/admin/automations");
}
