"use client";

import type { AutomationTrigger } from "@prisma/client";
import { useState } from "react";
import { type Action, ACTION_LABELS, ACTIONS_FOR, type Conditions, conditionsFor, PLACEHOLDERS, TRIGGERS } from "@/lib/automation/rules";

type Option = { id: string; name: string };
export type RuleDraft = { name: string; trigger: AutomationTrigger; active: boolean; conditions: Conditions; actions: Action[] };

/** Placeholders that mean something for each kind of trigger. */
const PLACEHOLDERS_FOR = {
  order: ["customer.firstName", "customer.name", "order.ref", "order.title", "order.total", "order.status", "order.dueDate", "order.link", "order.adminLink", "store.name", "business.name"],
  lead: ["lead.name", "lead.organization", "lead.source", "customer.firstName", "business.name"],
  request: ["customer.firstName", "customer.name", "store.name", "request.subject", "business.name"],
};

const blank = (type: Action["type"]): Action => {
  switch (type) {
    case "EMAIL_CUSTOMER":
      return { type, subject: "", body: "" };
    case "EMAIL_STAFF":
      return { type, to: "assignee", subject: "", body: "" };
    case "TASK":
      return { type, title: "", dueInDays: 1, assignTo: "assignee" };
    case "ASSIGN":
      return { type, staffId: "" };
    case "SET_STATUS":
      return { type, statusId: "" };
    default:
      return { type, text: "" };
  }
};

/**
 * The rule form's fields (inside an <ActionForm>): when it runs, what it
 * checks, and the list of things it does. Conditions and actions go to the
 * server as JSON in hidden inputs.
 */
export function RuleEditor({
  initial,
  statuses,
  stores,
  staff,
}: {
  initial: RuleDraft;
  statuses: (Option & { type: "QUOTE" | "ORDER" })[];
  stores: Option[];
  staff: Option[];
}) {
  const [trigger, setTrigger] = useState(initial.trigger);
  const [cond, setCond] = useState<Conditions>(initial.conditions);
  const [actions, setActions] = useState<Action[]>(initial.actions);
  // The message field placeholders go into.
  const [focus, setFocus] = useState<{ i: number; field: string } | null>(null);
  const about = TRIGGERS[trigger].about;
  const shown = conditionsFor(trigger, cond);
  const allowed = ACTIONS_FOR[about];

  const patch = (i: number, p: Partial<Action>) => setActions((list) => list.map((a, j) => (j === i ? ({ ...a, ...p } as Action) : a)));
  const move = (i: number, by: number) =>
    setActions((list) => {
      const next = [...list];
      const [a] = next.splice(i, 1);
      next.splice(i + by, 0, a);
      return next;
    });
  const insert = (key: string) => {
    if (!focus) return;
    const a = actions[focus.i] as Record<string, unknown>;
    if (typeof a?.[focus.field] !== "string") return;
    patch(focus.i, { [focus.field]: `${a[focus.field]}{{${key}}}` } as Partial<Action>);
  };
  const text = (i: number, field: string, value: string, o: { label: string; area?: boolean; placeholder?: string }) => {
    const props = {
      className: "input",
      value,
      placeholder: o.placeholder,
      "aria-label": o.label,
      onFocus: () => setFocus({ i, field }),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patch(i, { [field]: e.target.value } as Partial<Action>),
    };
    return (
      <div>
        <label className="label">{o.label}</label>
        {o.area ? <textarea {...props} rows={5} /> : <input {...props} />}
      </div>
    );
  };
  const staffSelect = (value: string, onChange: (v: string) => void, extra: { value: string; label: string }[], label: string) => (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        {extra.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
  const who = about === "lead" ? "the lead's owner" : "whoever it's assigned to";

  return (
    <div className="space-y-5 text-sm">
      <input type="hidden" name="conditions" value={JSON.stringify(shown)} />
      <input type="hidden" name="actions" value={JSON.stringify(actions.filter((a) => allowed.includes(a.type)))} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rule-name">Name</label>
          <input className="input" id="rule-name" name="name" defaultValue={initial.name} required placeholder="Thank customers when they pay" />
        </div>
        <div>
          <label className="label" htmlFor="rule-trigger">When</label>
          <select className="input" id="rule-trigger" name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
            {(Object.keys(TRIGGERS) as AutomationTrigger[]).map((t) => <option key={t} value={t}>{TRIGGERS[t].label}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={initial.active} /> On
      </label>

      {about !== "request" && (
        <fieldset className="space-y-3 rounded-md border border-gray-200 p-3" data-testid="rule-conditions">
          <legend className="px-1 font-medium">Only if <span className="font-normal text-gray-500">(optional)</span></legend>
          {about === "lead" ? (
            <div className="max-w-sm">
              <label className="label" htmlFor="rule-source">The lead&apos;s source contains</label>
              <input className="input" id="rule-source" value={cond.leadSource ?? ""} placeholder="Trade show" onChange={(e) => setCond({ ...cond, leadSource: e.target.value || undefined })} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {trigger === "STATUS_CHANGED" && (
                <div className="sm:col-span-2">
                  <span className="label">The new status is</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {statuses.map((s) => (
                      <label key={s.id} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={cond.statusIds?.includes(s.id) ?? false}
                          onChange={(e) => {
                            const ids = (cond.statusIds ?? []).filter((x) => x !== s.id);
                            setCond({ ...cond, statusIds: e.target.checked ? [...ids, s.id] : ids });
                          }}
                        />
                        {s.type === "QUOTE" ? "Quote" : "Order"}: {s.name}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">None ticked: any status.</p>
                </div>
              )}
              {"orderType" in conditionsFor(trigger, { orderType: "QUOTE" }) && (
                <div>
                  <label className="label" htmlFor="rule-type">Quotes or orders</label>
                  <select className="input" id="rule-type" value={cond.orderType ?? ""} onChange={(e) => setCond({ ...cond, orderType: (e.target.value || undefined) as Conditions["orderType"] })}>
                    <option value="">Either</option>
                    <option value="QUOTE">Quotes only</option>
                    <option value="ORDER">Orders only</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label" htmlFor="rule-store">Store</label>
                <select
                  className="input"
                  id="rule-store"
                  value={cond.store === "store" ? cond.storeId : (cond.store ?? "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCond({ ...cond, store: v === "" ? undefined : v === "none" ? "none" : "store", storeId: v && v !== "none" ? v : undefined });
                  }}
                >
                  <option value="">Any</option>
                  {trigger !== "ONLINE_ORDER" && <option value="none">Not from a store</option>}
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rule-min">Total at least</label>
                <input className="input" id="rule-min" inputMode="decimal" placeholder="$0" value={cond.minTotal ?? ""} onChange={(e) => setCond({ ...cond, minTotal: e.target.value === "" ? undefined : Number(e.target.value.replace(/[$,]/g, "")) })} />
              </div>
              <label className="flex items-center gap-2 self-end pb-2">
                <input type="checkbox" checked={cond.rushOnly ?? false} onChange={(e) => setCond({ ...cond, rushOnly: e.target.checked || undefined })} /> Rush only
              </label>
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="space-y-3" data-testid="rule-actions">
        <legend className="font-medium">Then</legend>
        {actions.map((a, i) => {
          const off = !allowed.includes(a.type);
          return (
            <div key={i} className={`space-y-2 rounded-md border p-3 ${off ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`} data-testid="rule-action">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{i + 1}. {ACTION_LABELS[a.type]}{off && <span className="ml-2 font-normal text-red-700">(doesn&apos;t apply to this trigger; it will be dropped)</span>}</div>
                <div className="flex gap-1 text-xs">
                  <button type="button" className="btn-secondary !px-2 !py-0.5" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button type="button" className="btn-secondary !px-2 !py-0.5" disabled={i === actions.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  <button type="button" className="btn-secondary !px-2 !py-0.5" onClick={() => setActions(actions.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </div>
              {(a.type === "EMAIL_CUSTOMER" || a.type === "EMAIL_STAFF") && (
                <>
                  {a.type === "EMAIL_STAFF" && staffSelect(a.to, (v) => patch(i, { to: v }), [{ value: "assignee", label: `To ${who}` }, { value: "business", label: "To the business email" }], "Send to")}
                  {text(i, "subject", a.subject, { label: "Subject" })}
                  {text(i, "body", a.body, { label: "Message", area: true })}
                  {a.type === "EMAIL_CUSTOMER" && about === "order" && <p className="text-xs text-gray-500">Comes from your business, with a button to their quote or order.</p>}
                </>
              )}
              {a.type === "TASK" && (
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem_14rem]">
                  {text(i, "title", a.title, { label: "Task", placeholder: "Call {{customer.firstName}}" })}
                  <div>
                    <label className="label">Due in (days)</label>
                    <input className="input" inputMode="numeric" value={a.dueInDays} aria-label="Due in days" onChange={(e) => patch(i, { dueInDays: Number(e.target.value) || 0 })} />
                  </div>
                  {staffSelect(a.assignTo, (v) => patch(i, { assignTo: v }), [{ value: "assignee", label: `For ${who}` }, { value: "", label: "Unassigned" }], "For")}
                </div>
              )}
              {a.type === "ASSIGN" && staffSelect(a.staffId, (v) => patch(i, { staffId: v }), [{ value: "", label: "Choose…" }], "Assign to")}
              {a.type === "SET_STATUS" && (
                <div>
                  <label className="label">Move to</label>
                  <select className="input" value={a.statusId} aria-label="Move to" onChange={(e) => patch(i, { statusId: e.target.value })}>
                    <option value="">Choose…</option>
                    {(["QUOTE", "ORDER"] as const).map((t) => (
                      <optgroup key={t} label={t === "QUOTE" ? "Quotes" : "Orders"}>
                        {statuses.filter((s) => s.type === t).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Skipped if it&apos;s a status for the other kind (a quote can&apos;t take an order status).</p>
                </div>
              )}
              {(a.type === "SLACK" || a.type === "NOTE") && text(i, "text", a.text, { label: a.type === "SLACK" ? "Message" : "Note", area: true })}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-500">Add:</span>
          {allowed.map((t) => (
            <button key={t} type="button" className="btn-secondary !py-1 text-xs" onClick={() => setActions([...actions, blank(t)])}>
              {ACTION_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900" data-testid="rule-placeholders">
        <div className="mb-1 font-medium">Placeholders{focus ? " (click to add to the field you were in)" : " (click a message field, then a placeholder to add it)"}</div>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS_FOR[about].map((k) => (
            <button key={k} type="button" onClick={() => insert(k)} className="rounded border border-amber-200 bg-white px-1.5 py-0.5 font-mono" title={`e.g. ${PLACEHOLDERS[k]}`}>
              {`{{${k}}}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
