import "server-only";
import type { AutomationTrigger, Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { type Action, ACTION_LABELS, ACTIONS_FOR, conditionsFor, parseActions, parseConditions, RuleError, TRIGGERS } from "./rules";

export { RuleError };

/**
 * Check a rule from the form: its conditions and actions are tidied, kept
 * to what fits the trigger, and every status, store and staff member they
 * name must belong to this business.
 */
export async function checkRule(db: BusinessDb, r: { name: string; trigger: AutomationTrigger; conditions: unknown; actions: unknown }) {
  const name = r.name.trim().slice(0, 120);
  if (!name) throw new RuleError("Name the rule");
  const conditions = conditionsFor(r.trigger, parseConditions(r.conditions));
  const actions: Action[] = parseActions(r.actions);
  const misfit = actions.find((a) => !ACTIONS_FOR[TRIGGERS[r.trigger].about].includes(a.type));
  if (misfit) throw new RuleError(`"${ACTION_LABELS[misfit.type]}" doesn't apply to this trigger`);

  const statusIds = [...(conditions.statusIds ?? []), ...actions.flatMap((a) => (a.type === "SET_STATUS" ? [a.statusId] : []))];
  const staffIds = actions.flatMap((a) =>
    a.type === "ASSIGN" ? [a.staffId] : a.type === "TASK" && a.assignTo && a.assignTo !== "assignee" ? [a.assignTo] : a.type === "EMAIL_STAFF" && !["assignee", "business"].includes(a.to) ? [a.to] : [],
  );
  const [statuses, staff, store] = await Promise.all([
    db.orderStatus.count({ where: { id: { in: [...new Set(statusIds)] } } }),
    db.staffUser.count({ where: { id: { in: [...new Set(staffIds)] } } }),
    conditions.storeId ? db.store.findUnique({ where: { id: conditions.storeId } }) : null,
  ]);
  if (statuses !== new Set(statusIds).size) throw new RuleError("One of the statuses no longer exists");
  if (staff !== new Set(staffIds).size) throw new RuleError("One of the staff members no longer exists");
  if (conditions.storeId && !store) throw new RuleError("That store no longer exists");
  return { name, trigger: r.trigger, conditions: conditions as Prisma.InputJsonObject, actions: actions as unknown as Prisma.InputJsonArray };
}
