import "server-only";
import type { AutomationEvent, AutomationRule } from "@prisma/client";
import { businessDomain } from "@/lib/business";
import { createTask } from "@/lib/crm/tasks";
import { logLeadEvent } from "@/lib/crm/leads";
import { type BusinessDb, forBusiness, prisma } from "@/lib/db";
import { isValidEmail, sendEmail } from "@/lib/email/mailer";
import { messageEmail, staffAlertEmail } from "@/lib/email/templates";
import { customerLink, ensurePublicToken } from "@/lib/orders/customer-flow";
import { orderRef } from "@/lib/orders/numbers";
import { assign, logEvent, setStatus } from "@/lib/orders/service";
import { addDays, today } from "@/lib/production/defaults";
import { postToSlack } from "@/lib/store/portal";
import { type Action, type Conditions, matches, render, TRIGGERS } from "./rules";

/** Automations set off by automations stop here, so rules can't loop forever. */
const MAX_DEPTH = 3;
const money = (v: { toFixed(n: number): string }) => `$${Number(v.toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

/**
 * Handle queued events: each is claimed once, its trigger's active rules
 * checked, and the matching rules' actions run in order. Every rule that
 * matched gets a run in the log, saying what it did or what went wrong;
 * a failing rule never stops the others.
 */
export async function runAutomations(db: BusinessDb, limit = 50): Promise<number> {
  const pending = await db.automationEvent.findMany({ where: { processedAt: null }, orderBy: { createdAt: "asc" }, take: limit });
  let handled = 0;
  for (const ev of pending) {
    const claimed = await db.automationEvent.updateMany({ where: { id: ev.id, processedAt: null }, data: { processedAt: new Date() } });
    if (claimed.count === 0) continue; // another worker has it
    handled++;
    if (ev.depth > MAX_DEPTH) continue;
    const rules = await db.automationRule.findMany({ where: { trigger: ev.trigger, active: true }, orderBy: { createdAt: "asc" } });
    if (rules.length === 0) continue;
    const ctx = await loadContext(db, ev);
    if (!ctx) continue;
    for (const rule of rules) {
      if (!matches(rule.conditions as Conditions, ctx.subject)) continue;
      const done: string[] = [];
      try {
        for (const action of rule.actions as Action[]) done.push(await runAction(db, rule, ev, ctx, action));
        await db.automationRun.create({ data: { businessId: db.$businessId, ruleId: rule.id, eventId: ev.id, ok: true, message: done.join("; ") || "Nothing to do" } });
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        await db.automationRun.create({ data: { businessId: db.$businessId, ruleId: rule.id, eventId: ev.id, ok: false, message: [...done, `Failed: ${why}`].join("; ").slice(0, 2000) } });
      }
    }
  }
  return handled;
}

/** Every business's queued events (the hourly sweep). */
export async function runAllAutomations(): Promise<number> {
  const businesses = await prisma.automationEvent.findMany({ where: { processedAt: null }, distinct: ["businessId"], select: { businessId: true } });
  let n = 0;
  for (const b of businesses) n += await runAutomations(forBusiness(b.businessId), 500);
  return n;
}

type Context = Awaited<ReturnType<typeof loadContext>> & {};

async function loadContext(db: BusinessDb, ev: AutomationEvent) {
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const origin = ev.origin ?? `https://${businessDomain(business)}`;
  const order = ev.orderId
    ? await db.order.findUnique({ where: { id: ev.orderId }, include: { customer: true, status: true, store: true, assignedTo: true } })
    : null;
  const request = ev.requestId ? await db.storeRequest.findUnique({ where: { id: ev.requestId }, include: { store: true, customer: true } }) : null;
  const lead = ev.leadId ? await db.lead.findUnique({ where: { id: ev.leadId }, include: { owner: true } }) : null;
  if (ev.orderId && !order) return null; // deleted since
  if (ev.leadId && !lead) return null;
  const person = order?.customer ?? request?.customer ?? null;
  const values: Record<string, string> = {
    "business.name": business.name,
    "customer.firstName": person?.firstName ?? lead?.firstName ?? "",
    "customer.name": person ? `${person.firstName} ${person.lastName}`.trim() : lead ? `${lead.firstName} ${lead.lastName}`.trim() : "",
    "customer.email": person?.email ?? lead?.email ?? "",
    "store.name": order?.store?.name ?? request?.store.name ?? "",
    "lead.name": lead ? `${lead.firstName} ${lead.lastName}`.trim() : "",
    "lead.organization": lead?.organization ?? "",
    "lead.source": lead?.source ?? "",
    "request.subject": request?.subject ?? "",
  };
  if (order) {
    Object.assign(values, {
      "order.ref": orderRef(order),
      "order.type": order.type === "QUOTE" ? "quote" : "order",
      "order.title": order.title ?? "",
      "order.total": money(order.total),
      "order.status": order.status.name,
      "order.dueDate": order.dueDate ? order.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "",
      "order.adminLink": `${origin}/admin/orders/${order.id}`,
    });
  }
  return {
    business,
    origin,
    order,
    lead,
    request,
    values,
    subject: {
      order: order ? { type: order.type, statusId: ev.statusId ?? order.statusId, storeId: order.storeId, rush: order.rush, total: order.total.toNumber() } : null,
      lead: lead ? { source: lead.source } : null,
    },
  };
}

async function runAction(db: BusinessDb, rule: AutomationRule, ev: AutomationEvent, ctx: Context, a: Action): Promise<string> {
  const { business, order, lead } = ctx;
  const brand = { name: business.name, email: business.email, phone: business.phone };
  const fill = async (t: string) => {
    // The customer's link is only made when a message uses it.
    if (order && t.includes("order.link") && !ctx.values["order.link"]) ctx.values["order.link"] = customerLink(ctx.origin, await ensurePublicToken(db, order.id));
    return render(t, ctx.values);
  };
  const note = async (body: string) => {
    if (order) await logEvent(db, db.$businessId, order.id, "NOTE", body, null);
    else if (lead) await db.$transaction((tx) => logLeadEvent(tx, lead.id, "NOTE", body, null));
  };
  const auto = `Automation "${rule.name}"`;

  switch (a.type) {
    case "EMAIL_CUSTOMER": {
      const to = order?.customer.email ?? ctx.request?.customer.email ?? lead?.email;
      if (!to || !isValidEmail(to)) return "No customer email to send to";
      const content = messageEmail({ brand, subject: await fill(a.subject), body: await fill(a.body), button: order && ctx.values["order.link"] ? { label: `View your ${ctx.values["order.type"]}`, url: ctx.values["order.link"] } : null });
      const r = await sendEmail(db, { ...content, to, fromName: business.name, replyTo: business.email, orderId: order?.id });
      if (order) await logEvent(db, db.$businessId, order.id, "EMAIL", `${auto} emailed ${to}: ${content.subject}`, null);
      return `Emailed ${to} (${r.status.toLowerCase()})`;
    }
    case "EMAIL_STAFF": {
      const staffEmail =
        a.to === "business"
          ? business.email
          : a.to === "assignee"
            ? (order?.assignedTo?.email ?? lead?.owner?.email ?? null)
            : ((await db.staffUser.findUnique({ where: { id: a.to } }))?.email ?? null);
      if (!staffEmail || !isValidEmail(staffEmail)) return "No staff email to send to";
      const url = order ? ctx.values["order.adminLink"] : lead ? `${ctx.origin}/admin/leads/${lead.id}` : `${ctx.origin}/admin`;
      const content = staffAlertEmail({ brand, heading: await fill(a.subject), lines: (await fill(a.body)).split(/\n\s*\n/), url });
      await sendEmail(db, { ...content, to: staffEmail, fromName: business.name, orderId: order?.id });
      return `Emailed ${staffEmail}`;
    }
    case "TASK": {
      const assigneeId = a.assignTo === "assignee" ? (order?.assignedToId ?? lead?.ownerId ?? null) : a.assignTo || null;
      await createTask(
        db,
        {
          title: await fill(a.title),
          notes: `Made by ${auto}`,
          dueDate: addDays(today(), a.dueInDays),
          assigneeId,
          orderId: order?.id,
          customerId: order?.customerId ?? ctx.request?.customerId,
          leadId: lead?.id,
        },
        null,
      );
      return `Task: ${await fill(a.title)}`;
    }
    case "ASSIGN": {
      const staff = await db.staffUser.findUnique({ where: { id: a.staffId } });
      if (!staff) return "That staff member no longer exists";
      if (order) await assign(db, order.id, staff.id, null);
      else if (lead) await db.lead.update({ where: { id: lead.id }, data: { ownerId: staff.id } });
      else return "Nothing to assign";
      return `Assigned to ${staff.name}`;
    }
    case "SET_STATUS": {
      if (!order) return "Only quotes and orders have a status";
      const status = await db.orderStatus.findUnique({ where: { id: a.statusId } });
      if (!status || status.type !== order.type) return `That status isn't for ${order.type === "QUOTE" ? "quotes" : "orders"}`;
      await setStatus(db, order.id, status.id, null, { depth: ev.depth + 1, reason: auto });
      return `Status set to ${status.name}`;
    }
    case "SLACK": {
      const sent = await postToSlack(business.slackWebhookEnc, await fill(a.text));
      return sent ? "Posted to Slack" : business.slackWebhookEnc ? "Slack didn't accept the message" : "No Slack webhook saved";
    }
    case "NOTE": {
      await note(`${await fill(a.text)}\n(${auto})`);
      return "Note added";
    }
  }
}

export const triggerAbout = (t: AutomationEvent["trigger"]) => TRIGGERS[t].about;
