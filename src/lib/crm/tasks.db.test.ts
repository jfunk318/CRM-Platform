// Follow-up tasks: buckets, linking, done, and automatic quote follow-ups.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/service";
import { setUpBusiness } from "@/lib/platform/setup";
import { makeTestBusiness } from "@/test/fixtures";
import { createLead } from "./leads";
import { bucketOf, createQuoteFollowUps, createTask, dueLabel, dueTaskCount, setTaskDone, TaskError } from "./tasks";

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("task dates", () => {
  const today = day("2026-11-10");
  it("sorts tasks into overdue, today, coming up, no date and done", () => {
    expect(bucketOf({ dueDate: day("2026-11-09"), doneAt: null }, today)).toBe("overdue");
    expect(bucketOf({ dueDate: today, doneAt: null }, today)).toBe("today");
    expect(bucketOf({ dueDate: day("2026-11-12"), doneAt: null }, today)).toBe("upcoming");
    expect(bucketOf({ dueDate: null, doneAt: null }, today)).toBe("someday");
    expect(bucketOf({ dueDate: day("2026-11-01"), doneAt: new Date() }, today)).toBe("done");
  });
  it("reads due dates the way people say them", () => {
    expect([today, day("2026-11-11"), day("2026-11-13"), day("2026-12-01"), day("2026-11-03"), null].map((d) => dueLabel(d, today))).toEqual([
      "Today",
      "Tomorrow",
      "Fri, Nov 13",
      "Dec 1",
      "Overdue · Nov 3",
      "No due date",
    ]);
  });
});

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let other: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`tasks-${Date.now()}`);
  other = await makeTestBusiness(`tasks-other-${Date.now()}`);
  await setUpBusiness(t.db);
});
afterAll(async () => {
  await t.cleanup();
  await other.cleanup();
  await prisma.$disconnect();
});

describe("tasks", () => {
  it("are linked to a lead, noted on its timeline, and ticked off", async () => {
    const leadId = await createLead(t.db, { firstName: "Ana", lastName: "", organization: null, title: null, email: null, phone: null, source: null, interest: null, estimatedValue: null, ownerId: null }, t.staff.id);
    const id = await createTask(t.db, { title: "  Send   samples ", notes: null, dueDate: day("2026-11-12"), assigneeId: t.staff.id, leadId }, t.staff.id);
    expect(await t.db.task.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: "Send samples", leadId, createdById: t.staff.id, doneAt: null });
    await setTaskDone(t.db, id, true, t.staff.id);
    expect((await t.db.task.findUniqueOrThrow({ where: { id } })).doneById).toBe(t.staff.id);
    const notes = await t.db.leadEvent.findMany({ where: { leadId, type: "NOTE" }, orderBy: { createdAt: "asc" } });
    expect(notes.map((n) => n.body)).toEqual(["Task: Send samples (due Nov 12)", "Done: Send samples"]);
    await setTaskDone(t.db, id, false, t.staff.id);
    expect((await t.db.task.findUniqueOrThrow({ where: { id } })).doneAt).toBeNull();
  });

  it("count what's due for someone, and can't point at another business's records", async () => {
    const before = await dueTaskCount(t.db, t.staff.id, day("2026-11-10"));
    await createTask(t.db, { title: "Overdue call", notes: null, dueDate: day("2026-11-01"), assigneeId: t.staff.id }, null);
    await createTask(t.db, { title: "Later", notes: null, dueDate: day("2026-12-01"), assigneeId: t.staff.id }, null);
    expect(await dueTaskCount(t.db, t.staff.id, day("2026-11-10"))).toBe(before + 1);
    await expect(createTask(t.db, { title: "x", notes: null, dueDate: null, assigneeId: null, customerId: other.customer.id }, null)).rejects.toThrow(TaskError);
    await expect(createTask(t.db, { title: " ", notes: null, dueDate: null, assigneeId: null }, null)).rejects.toThrow(/needs doing/);
  });
});

describe("quote follow-ups", () => {
  it("are made once for quotes emailed long enough ago with no answer", async () => {
    const quoteId = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    const sent = await t.db.orderStatus.findFirstOrThrow({ where: { role: "QUOTE_SENT" } });
    await t.db.order.update({ where: { id: quoteId }, data: { statusId: sent.id } });
    const now = new Date();
    const email = await t.db.orderEvent.create({ data: { businessId: t.business.id, orderId: quoteId, type: "EMAIL", body: "Quote emailed to pat@example.com", createdAt: new Date(now.getTime() - 2 * 86_400_000) } });
    expect(await createQuoteFollowUps(t.db, now)).toBe(0); // only 2 days (default is 5)
    await t.db.orderEvent.update({ where: { id: email.id }, data: { createdAt: new Date(now.getTime() - 6 * 86_400_000) } });
    expect(await createQuoteFollowUps(t.db, now)).toBe(1);
    expect(await createQuoteFollowUps(t.db, now)).toBe(0);
    const task = await t.db.task.findFirstOrThrow({ where: { orderId: quoteId } });
    expect(task).toMatchObject({ assigneeId: t.staff.id, customerId: t.customer.id, autoKey: `quote-follow-up:${email.id}` });
    expect(task.title).toMatch(/^Follow up on quote Q-\d+ for Pat Lee$/);
    await t.db.business.update({ where: { id: t.business.id }, data: { quoteFollowUpDays: null } });
    await t.db.orderEvent.create({ data: { businessId: t.business.id, orderId: quoteId, type: "EMAIL", body: "Quote emailed to pat@example.com", createdAt: new Date(now.getTime() - 9 * 86_400_000) } });
    expect(await createQuoteFollowUps(t.db, now)).toBe(0);
  });
});
