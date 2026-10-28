import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { ACTION_LABELS, type Action, type Conditions, describeConditions, RECIPES, TRIGGERS } from "@/lib/automation/rules";
import { orderRef } from "@/lib/orders/numbers";
import { toggleRuleAction } from "./actions";

export const metadata = { title: "Automations" };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** Rules that do things when something happens, and what they've done lately. */
export default async function AutomationsPage() {
  const { db } = await requireStaff(["ADMIN"]);
  const [rules, runs, statuses, stores] = await Promise.all([
    db.automationRule.findMany({ orderBy: { createdAt: "asc" }, include: { runs: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { runs: true } } } }),
    db.automationRun.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { rule: { select: { id: true, name: true } }, event: true } }),
    db.orderStatus.findMany({ select: { id: true, name: true } }),
    db.store.findMany({ select: { id: true, name: true } }),
  ]);
  const names = { statuses: new Map(statuses.map((s) => [s.id, s.name])), stores: new Map(stores.map((s) => [s.id, s.name])) };
  const orderIds = [...new Set(runs.flatMap((r) => (r.event.orderId ? [r.event.orderId] : [])))];
  const orders = new Map((await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true, type: true } })).map((o) => [o.id, o]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Automations</h1>
          <p className="max-w-2xl text-sm text-gray-500">
            When something happens (a quote is created, an order is paid, a lead comes in…), a rule checks its conditions and does
            its list of things: email the customer or your team, create a task, assign, change the status, post to Slack or add a note.
          </p>
        </div>
        <Link href="/admin/automations/new" className="btn">New rule</Link>
      </div>

      {rules.length === 0 ? (
        <section className="card space-y-2" data-testid="recipes">
          <h2 className="font-semibold">Start from a recipe</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(RECIPES).map(([key, r]) => (
              <li key={key}>
                <Link href={`/admin/automations/new?recipe=${key}`} className="block rounded-md border border-gray-200 p-3 hover:border-amber-400">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">{TRIGGERS[r.trigger].label} → {r.actions.map((a) => ACTION_LABELS[a.type].toLowerCase()).join(", ")}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card overflow-x-auto">
          <table className="table" data-testid="rules">
            <thead>
              <tr><th>Rule</th><th>When</th><th>Does</th><th>Last ran</th><th></th></tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const cond = describeConditions(r.conditions as Conditions, names);
                const last = r.runs[0];
                return (
                  <tr key={r.id} className={r.active ? "" : "text-gray-400"}>
                    <td><Link href={`/admin/automations/${r.id}`} className="font-medium text-amber-700 hover:underline">{r.name}</Link></td>
                    <td>{TRIGGERS[r.trigger].label}{cond && <div className="text-xs text-gray-500">{cond}</div>}</td>
                    <td className="text-xs">{(r.actions as Action[]).map((a) => ACTION_LABELS[a.type]).join(" → ")}</td>
                    <td className="text-xs">
                      {last ? <span className={last.ok ? "" : "text-red-600"}>{when(last.createdAt)}{last.ok ? "" : " (failed)"}</span> : "Never"}
                      {r._count.runs > 1 && <div className="text-gray-500">{r._count.runs} times</div>}
                    </td>
                    <td>
                      <ActionForm action={toggleRuleAction} submitLabel={r.active ? "Turn off" : "Turn on"} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing yet. Runs show up here as rules do their work.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm" data-testid="runs">
            {runs.map((r) => {
              const o = r.event.orderId ? orders.get(r.event.orderId) : null;
              return (
                <li key={r.id} className="flex flex-wrap gap-x-3 py-2">
                  <span className="w-32 shrink-0 text-xs text-gray-500">{when(r.createdAt)}</span>
                  <span className={r.ok ? "text-green-700" : "text-red-600"}>{r.ok ? "✓" : "✕"}</span>
                  <Link href={`/admin/automations/${r.rule.id}`} className="font-medium hover:underline">{r.rule.name}</Link>
                  {o && <Link href={`/admin/orders/${o.id}`} className="text-amber-700 hover:underline">{orderRef(o)}</Link>}
                  {r.event.leadId && <Link href={`/admin/leads/${r.event.leadId}`} className="text-amber-700 hover:underline">Lead</Link>}
                  <span className="basis-full pl-[8.75rem] text-xs text-gray-600">{r.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
