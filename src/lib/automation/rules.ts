// Automation rules: what can start them, what they check and what they do.
// Pure (no database), so the form, the engine and the tests share it.
import type { AutomationTrigger, OrderType } from "@prisma/client";

export const TRIGGERS: Record<AutomationTrigger, { label: string; about: "order" | "lead" | "request" }> = {
  QUOTE_CREATED: { label: "A quote is created", about: "order" },
  ORDER_CREATED: { label: "An order is created", about: "order" },
  ONLINE_ORDER: { label: "An order is placed in a store", about: "order" },
  STATUS_CHANGED: { label: "A quote or order changes status", about: "order" },
  ORDER_PAID: { label: "An order is paid in full", about: "order" },
  PROOF_APPROVED: { label: "The customer approves a proof", about: "order" },
  PROOF_CHANGES: { label: "The customer asks for proof changes", about: "order" },
  LEAD_CREATED: { label: "A new lead comes in", about: "lead" },
  STORE_REQUEST: { label: "A store owner sends a request", about: "request" },
};

export type Conditions = {
  /** STATUS_CHANGED: the new status is one of these. */
  statusIds?: string[];
  orderType?: OrderType;
  /** "none": not from a store; "store": from `storeId`; omitted: any. */
  store?: "none" | "store";
  storeId?: string;
  rushOnly?: boolean;
  minTotal?: number;
  /** Leads: the source contains this (any case). */
  leadSource?: string;
};

export type Action =
  | { type: "EMAIL_CUSTOMER"; subject: string; body: string }
  | { type: "EMAIL_STAFF"; to: string; subject: string; body: string } // to: "assignee" | "business" | a staff id
  | { type: "TASK"; title: string; dueInDays: number; assignTo: string } // assignTo: "assignee" | "" | a staff id
  | { type: "ASSIGN"; staffId: string }
  | { type: "SET_STATUS"; statusId: string }
  | { type: "SLACK"; text: string }
  | { type: "NOTE"; text: string };

export const ACTION_LABELS: Record<Action["type"], string> = {
  EMAIL_CUSTOMER: "Email the customer",
  EMAIL_STAFF: "Email staff",
  TASK: "Create a task",
  ASSIGN: "Assign to",
  SET_STATUS: "Set the status",
  SLACK: "Post to Slack",
  NOTE: "Add a note to the timeline",
};

/** Actions that can apply to each kind of trigger. */
export const ACTIONS_FOR: Record<"order" | "lead" | "request", Action["type"][]> = {
  order: ["EMAIL_CUSTOMER", "EMAIL_STAFF", "TASK", "ASSIGN", "SET_STATUS", "SLACK", "NOTE"],
  lead: ["EMAIL_CUSTOMER", "EMAIL_STAFF", "TASK", "ASSIGN", "SLACK", "NOTE"],
  request: ["EMAIL_CUSTOMER", "EMAIL_STAFF", "TASK", "SLACK"],
};

/** Placeholders offered in messages, with an example each. */
export const PLACEHOLDERS: Record<string, string> = {
  "customer.firstName": "Pat",
  "customer.name": "Pat Lee",
  "order.ref": "#1042 / Q-1042",
  "order.title": "Spring uniforms",
  "order.total": "$1,240.00",
  "order.status": "In production",
  "order.dueDate": "Nov 20",
  "order.link": "the customer's link to it",
  "order.adminLink": "the back-office page",
  "store.name": "Tigers Football",
  "lead.name": "Jordan Lee",
  "lead.organization": "Westfield Soccer",
  "lead.source": "Trade show",
  "request.subject": "Add hoodies",
  "business.name": "Your business",
};

/** Fill `{{placeholders}}`; unknown ones are left blank. */
export const render = (template: string, values: Record<string, string>) => template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => values[k] ?? "");

export class RuleError extends Error {}

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Check and tidy actions from the rule form. */
export function parseActions(raw: unknown): Action[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new RuleError("Add at least one action");
  if (raw.length > 10) throw new RuleError("A rule can do at most 10 things");
  return raw.map((a, i): Action => {
    const n = `Action ${i + 1}`;
    const o = (a ?? {}) as Record<string, unknown>;
    switch (o.type) {
      case "EMAIL_CUSTOMER":
      case "EMAIL_STAFF": {
        const subject = str(o.subject, 200);
        const body = str(o.body);
        if (!subject || !body) throw new RuleError(`${n}: write the email's subject and message`);
        if (o.type === "EMAIL_CUSTOMER") return { type: "EMAIL_CUSTOMER", subject, body };
        const to = str(o.to, 60);
        if (!to) throw new RuleError(`${n}: choose who to email`);
        return { type: "EMAIL_STAFF", to, subject, body };
      }
      case "TASK": {
        const title = str(o.title, 200);
        if (!title) throw new RuleError(`${n}: say what the task is`);
        const days = Number(o.dueInDays ?? 0);
        if (!Number.isInteger(days) || days < 0 || days > 365) throw new RuleError(`${n}: due in 0 to 365 days`);
        return { type: "TASK", title, dueInDays: days, assignTo: str(o.assignTo, 60) };
      }
      case "ASSIGN": {
        const staffId = str(o.staffId, 60);
        if (!staffId) throw new RuleError(`${n}: choose who to assign`);
        return { type: "ASSIGN", staffId };
      }
      case "SET_STATUS": {
        const statusId = str(o.statusId, 60);
        if (!statusId) throw new RuleError(`${n}: choose a status`);
        return { type: "SET_STATUS", statusId };
      }
      case "SLACK":
      case "NOTE": {
        const text = str(o.text);
        if (!text) throw new RuleError(`${n}: write the message`);
        return { type: o.type, text };
      }
      default:
        throw new RuleError(`${n}: choose what to do`);
    }
  });
}

/** Check and tidy conditions from the rule form. */
export function parseConditions(raw: unknown): Conditions {
  const o = (raw ?? {}) as Record<string, unknown>;
  const c: Conditions = {};
  if (Array.isArray(o.statusIds) && o.statusIds.length) c.statusIds = o.statusIds.filter((s): s is string => typeof s === "string").slice(0, 30);
  if (o.orderType === "QUOTE" || o.orderType === "ORDER") c.orderType = o.orderType;
  if (o.store === "none") c.store = "none";
  if (o.store === "store") {
    if (typeof o.storeId !== "string" || !o.storeId) throw new RuleError("Choose the store");
    c.store = "store";
    c.storeId = o.storeId;
  }
  if (o.rushOnly === true) c.rushOnly = true;
  if (o.minTotal !== undefined && o.minTotal !== null && o.minTotal !== "") {
    const n = Number(o.minTotal);
    if (!Number.isFinite(n) || n < 0) throw new RuleError("Minimum total must be a number");
    c.minTotal = n;
  }
  const src = str(o.leadSource, 80);
  if (src) c.leadSource = src;
  return c;
}

export type MatchSubject = {
  order?: { type: OrderType; statusId: string; storeId: string | null; rush: boolean; total: number } | null;
  lead?: { source: string | null } | null;
};

/** Whether an event's subject meets the rule's conditions. */
export function matches(c: Conditions, s: MatchSubject): boolean {
  const o = s.order;
  if (c.statusIds?.length && (!o || !c.statusIds.includes(o.statusId))) return false;
  if (c.orderType && o?.type !== c.orderType) return false;
  if (c.store === "none" && o?.storeId) return false;
  if (c.store === "store" && o?.storeId !== c.storeId) return false;
  if (c.rushOnly && !o?.rush) return false;
  if (c.minTotal !== undefined && (!o || o.total < c.minTotal)) return false;
  if (c.leadSource && !s.lead?.source?.toLowerCase().includes(c.leadSource.toLowerCase())) return false;
  return true;
}

/** Keep only the conditions that make sense for a trigger. */
export function conditionsFor(trigger: AutomationTrigger, c: Conditions): Conditions {
  const about = TRIGGERS[trigger].about;
  if (about === "lead") return c.leadSource ? { leadSource: c.leadSource } : {};
  if (about === "request") return {};
  const { leadSource: _, ...order } = c;
  void _;
  if (trigger !== "STATUS_CHANGED") delete order.statusIds;
  // These triggers already say whether it's a quote or an order.
  if (["QUOTE_CREATED", "ORDER_CREATED", "ONLINE_ORDER", "ORDER_PAID"].includes(trigger)) delete order.orderType;
  if (trigger === "ONLINE_ORDER" && order.store === "none") delete order.store;
  return order;
}

/** "Rush, from Tigers Football, $500 or more" for the rule list. */
export function describeConditions(c: Conditions, names: { statuses: Map<string, string>; stores: Map<string, string> }): string {
  const parts: string[] = [];
  if (c.statusIds?.length) parts.push(`to ${c.statusIds.map((id) => names.statuses.get(id) ?? "a removed status").join(" or ")}`);
  if (c.orderType) parts.push(c.orderType === "QUOTE" ? "quotes only" : "orders only");
  if (c.store === "none") parts.push("not from a store");
  if (c.store === "store") parts.push(`from ${names.stores.get(c.storeId ?? "") ?? "a removed store"}`);
  if (c.rushOnly) parts.push("rush only");
  if (c.minTotal !== undefined) parts.push(`$${c.minTotal.toLocaleString("en-US")} or more`);
  if (c.leadSource) parts.push(`source contains "${c.leadSource}"`);
  return parts.join(", ");
}

/** Ready-made rules to start from. */
export const RECIPES: Record<string, { name: string; trigger: AutomationTrigger; conditions: Conditions; actions: Action[] }> = {
  "paid-thanks": {
    name: "Thank the customer when they pay",
    trigger: "ORDER_PAID",
    conditions: {},
    actions: [
      {
        type: "EMAIL_CUSTOMER",
        subject: "Thanks for your payment — {{order.ref}}",
        body: "Hi {{customer.firstName}},\n\nWe've received your payment of {{order.total}} for {{order.ref}}. We'll let you know as soon as it's on its way.\n\nThanks,\n{{business.name}}",
      },
    ],
  },
  "lead-call": {
    name: "Call new leads the next day",
    trigger: "LEAD_CREATED",
    conditions: {},
    actions: [{ type: "TASK", title: "Call {{lead.name}}", dueInDays: 1, assignTo: "assignee" }],
  },
  "proof-approved": {
    name: "Tell the assignee when a proof is approved",
    trigger: "PROOF_APPROVED",
    conditions: {},
    actions: [{ type: "EMAIL_STAFF", to: "assignee", subject: "Proof approved: {{order.ref}}", body: "{{customer.name}} approved the proof for {{order.ref}} ({{order.title}})." }],
  },
  "store-slack": {
    name: "Post store orders to Slack",
    trigger: "ONLINE_ORDER",
    conditions: {},
    actions: [{ type: "SLACK", text: "New order {{order.ref}} from {{store.name}}: {{order.total}}" }],
  },
  "store-request": {
    name: "Answer store owners' requests within a day",
    trigger: "STORE_REQUEST",
    conditions: {},
    actions: [{ type: "TASK", title: "Reply to {{store.name}}: {{request.subject}}", dueInDays: 1, assignTo: "" }],
  },
};
