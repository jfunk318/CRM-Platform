// Rules running end to end: events from real changes, conditions, actions
// and the run log.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createLead } from "@/lib/crm/leads";
import { recordPayment } from "@/lib/orders/payments";
import { addLine, assign, convertQuote, createOrder, setStatus } from "@/lib/orders/service";
import { makeTestBusiness } from "@/test/fixtures";
import { runAutomations } from "./engine";
import type { Action, Conditions } from "./rules";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
const status = (name: string) => t.db.orderStatus.findFirstOrThrow({ where: { name } });
const rule = (name: string, trigger: Prisma.AutomationRuleCreateInput["trigger"], actions: Action[], conditions: Conditions = {}) =>
  t.db.automationRule.create({ data: { businessId: t.business.id, name, trigger, actions: actions as unknown as Prisma.InputJsonArray, conditions: conditions as Prisma.InputJsonObject } });
const runsOf = (ruleId: string) => t.db.automationRun.findMany({ where: { ruleId }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  t = await makeTestBusiness(`auto-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

describe("automations", () => {
  it("note nothing when no rule listens", async () => {
    await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    expect(await t.db.automationEvent.count()).toBe(0);
  });

  it("thank the customer and make a task when an order is paid in full, once", async () => {
    const r = await rule("Paid", "ORDER_PAID", [
      { type: "EMAIL_CUSTOMER", subject: "Thanks for paying {{order.ref}}", body: "Hi {{customer.firstName}}, we got {{order.total}}." },
      { type: "TASK", title: "Pack {{order.ref}}", dueInDays: 2, assignTo: "assignee" },
    ]);
    const orderId = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
    await addLine(t.db, orderId, t.line(12), t.staff.id);
    await assign(t.db, orderId, t.staff.id, null);
    const order = await t.db.order.findUniqueOrThrow({ where: { id: orderId } });
    const pay = (amount: Prisma.Decimal) => recordPayment(t.db, orderId, { amount, refund: false, method: "CASH", reference: null, note: null, receivedAt: new Date(), staffId: null });
    await pay(new Prisma.Decimal(10));
    expect(await t.db.automationEvent.count({ where: { trigger: "ORDER_PAID" } })).toBe(0); // not in full yet
    await pay(order.total.minus(10));
    expect(await runAutomations(t.db)).toBe(1);
    const ref = `#${order.number}`;
    const email = await t.db.emailMessage.findFirstOrThrow({ where: { orderId, to: "pat@example.com" } });
    expect(email.subject).toBe(`Thanks for paying ${ref}`);
    expect(email.text).toContain(`Hi Pat, we got $${order.total.toFixed(2)}.`);
    const task = await t.db.task.findFirstOrThrow({ where: { orderId } });
    expect(task).toMatchObject({ title: `Pack ${ref}`, assigneeId: t.staff.id });
    const [run] = await runsOf(r.id);
    expect(run).toMatchObject({ ok: true, message: `Emailed pat@example.com (${email.status.toLowerCase()}); Task: Pack ${ref}` });
    // Handled events aren't run again.
    expect(await runAutomations(t.db)).toBe(0);
    await t.db.automationRule.delete({ where: { id: r.id } });
  });

  it("check conditions, and stop rules that set off each other", async () => {
    const [sent, approved] = await Promise.all([status("Sent"), status("Approved")]);
    const ping = await rule("Sent → approved", "STATUS_CHANGED", [{ type: "SET_STATUS", statusId: approved.id }], { statusIds: [sent.id], orderType: "QUOTE" });
    const pong = await rule("Approved → sent", "STATUS_CHANGED", [{ type: "SET_STATUS", statusId: sent.id }], { statusIds: [approved.id], minTotal: 1 });
    const quoteId = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    await addLine(t.db, quoteId, t.line(12), t.staff.id);
    await setStatus(t.db, quoteId, sent.id, t.staff.id);
    for (let i = 0; i < 10 && (await runAutomations(t.db)); i++);
    // Depth 0 to 3 run; the event at depth 4 is dropped.
    expect((await runsOf(ping.id)).length + (await runsOf(pong.id)).length).toBe(4);
    const log = await t.db.orderEvent.findMany({ where: { orderId: quoteId, type: "STATUS" } });
    expect(log.at(-1)?.body).toMatch(/\(Automation "(Sent → approved|Approved → sent)"\)$/);

    // An empty quote doesn't meet "total at least $1".
    const empty = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    await setStatus(t.db, empty, approved.id, t.staff.id);
    const before = (await runsOf(pong.id)).length;
    await runAutomations(t.db);
    expect((await runsOf(pong.id)).length).toBe(before);
    await t.db.automationRule.deleteMany({ where: { id: { in: [ping.id, pong.id] } } });
  });

  it("log a failed action, and keep running the other rules", async () => {
    const gone = await t.db.staffUser.create({ data: { businessId: t.business.id, email: "gone@example.com", name: "Gone", roles: [] } });
    const bad = await rule("Bad", "LEAD_CREATED", [{ type: "NOTE", text: "Hello {{lead.name}}" }, { type: "TASK", title: "x", dueInDays: 0, assignTo: gone.id }]);
    const good = await rule("Good", "LEAD_CREATED", [{ type: "TASK", title: "Call {{lead.name}} ({{lead.organization}})", dueInDays: 1, assignTo: "assignee" }], { leadSource: "show" });
    const skip = await rule("Web only", "LEAD_CREATED", [{ type: "NOTE", text: "web" }], { leadSource: "web" });
    await t.db.staffUser.delete({ where: { id: gone.id } });
    const leadId = await createLead(
      t.db,
      { firstName: "Jordan", lastName: "Lee", organization: "Westfield", title: null, email: null, phone: null, source: "Trade show", interest: null, estimatedValue: null, ownerId: t.staff.id },
      null,
    );
    await runAutomations(t.db);
    const [b] = await runsOf(bad.id);
    expect(b.ok).toBe(false);
    expect(b.message).toMatch(/^Note added; Failed: /);
    expect(await t.db.leadEvent.findFirst({ where: { leadId, type: "NOTE" } })).toMatchObject({ body: 'Hello Jordan Lee\n(Automation "Bad")' });
    expect(await t.db.task.findFirstOrThrow({ where: { leadId } })).toMatchObject({ title: "Call Jordan Lee (Westfield)", assigneeId: t.staff.id });
    expect(await runsOf(skip.id)).toHaveLength(0);
    await t.db.automationRule.deleteMany({ where: { id: { in: [bad.id, good.id, skip.id] } } });
  });

  it("run when a quote becomes an order, which keeps its names and numbers", async () => {
    const r = await rule("New order note", "ORDER_CREATED", [{ type: "NOTE", text: "Order {{order.ref}} for {{customer.name}}, {{order.status}}" }]);
    const quoteId = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    const lineId = await addLine(t.db, quoteId, t.line(12), t.staff.id);
    await t.db.orderLineName.create({ data: { businessId: t.business.id, lineId, sizeId: t.product.sizes[0].id, name: "SMITH", number: "12", charge: 5 } });
    const orderId = await convertQuote(t.db, quoteId, t.staff.id);
    await runAutomations(t.db);
    const order = await t.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: { include: { names: true } } } });
    expect(order.lines[0].names).toMatchObject([{ name: "SMITH", number: "12" }]);
    expect(await t.db.orderEvent.findFirst({ where: { orderId, type: "NOTE" } })).toMatchObject({ body: `Order #${order.number} for Pat Lee, New\n(Automation "New order note")` });
    expect(await runsOf(r.id)).toHaveLength(1);
  });
});
