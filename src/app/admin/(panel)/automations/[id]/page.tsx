import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { RuleEditor, type RuleDraft } from "@/components/admin/rule-editor";
import { type Action, type Conditions, RECIPES } from "@/lib/automation/rules";
import { deleteRuleAction, saveRuleAction } from "../actions";

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** A new rule (optionally from a recipe) or an existing one, with its runs. */
export default async function RulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ recipe?: string }> }) {
  const { db } = await requireStaff(["ADMIN"]);
  const { id } = await params;
  const { recipe } = await searchParams;
  const rule = id === "new" ? null : await db.automationRule.findUnique({ where: { id }, include: { runs: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (id !== "new" && !rule) notFound();
  const [statuses, stores, staff] = await Promise.all([
    db.orderStatus.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, type: true } }),
    db.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const start = recipe && recipe in RECIPES ? RECIPES[recipe] : null;
  const initial: RuleDraft = rule
    ? { name: rule.name, trigger: rule.trigger, active: rule.active, conditions: rule.conditions as Conditions, actions: rule.actions as Action[] }
    : { name: start?.name ?? "", trigger: start?.trigger ?? "ORDER_PAID", active: true, conditions: start?.conditions ?? {}, actions: start?.actions ?? [] };

  return (
    <div className="space-y-5">
      <Link href="/admin/automations" className="text-sm text-amber-700 hover:underline">← Automations</Link>
      <h1 className="page-title">{rule ? rule.name : "New rule"}</h1>
      <section className="card">
        <ActionForm action={saveRuleAction} submitLabel={rule ? "Save" : "Create rule"}>
          {rule && <input type="hidden" name="id" value={rule.id} />}
          <RuleEditor initial={initial} statuses={statuses} stores={stores} staff={staff} />
        </ActionForm>
      </section>
      {rule && (
        <>
          <section className="card space-y-2">
            <h2 className="font-semibold">Runs</h2>
            {rule.runs.length === 0 ? (
              <p className="text-sm text-gray-500">It hasn&apos;t run yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {rule.runs.map((r) => (
                  <li key={r.id} className="flex gap-3 py-1.5">
                    <span className="w-32 shrink-0 text-xs text-gray-500">{when(r.createdAt)}</span>
                    <span className={r.ok ? "text-green-700" : "text-red-600"}>{r.ok ? "✓" : "✕"}</span>
                    <span className="text-gray-700">{r.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <ActionForm action={deleteRuleAction} submitLabel="Delete rule" danger confirm={`Delete "${rule.name}" and its run history?`}>
            <input type="hidden" name="id" value={rule.id} />
          </ActionForm>
        </>
      )}
    </div>
  );
}
