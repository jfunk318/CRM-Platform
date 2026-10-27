// The pipeline board: leads and quotes by stage.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addLine, convertQuote, createOrder } from "@/lib/orders/service";
import { makeTestBusiness } from "@/test/fixtures";
import { createLead, type LeadInput, setLeadStatus } from "./leads";
import { loadPipeline, quoteStage, winRate } from "./pipeline";

describe("quote stages", () => {
  it("follow the quote's status", () => {
    expect(quoteStage({ role: null, isClosed: false })).toBe("QUOTING");
    expect(quoteStage({ role: "QUOTE_SENT", isClosed: false })).toBe("SENT");
    expect(quoteStage({ role: "QUOTE_CHANGES_REQUESTED", isClosed: false })).toBe("SENT");
    expect(quoteStage({ role: "QUOTE_APPROVED", isClosed: false })).toBe("WON");
    expect(quoteStage({ role: "QUOTE_CONVERTED", isClosed: true })).toBe("WON");
    expect(quoteStage({ role: null, isClosed: true })).toBe("LOST");
  });
});

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`pipe-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const lead = (p: Partial<LeadInput>) =>
  createLead(t.db, { firstName: "A", lastName: "", organization: null, title: null, email: null, phone: null, source: null, interest: null, estimatedValue: null, ownerId: null, ...p }, null);
const status = (role: string | null, name?: string) => t.db.orderStatus.findFirstOrThrow({ where: { type: "QUOTE", ...(role ? { role: role as never } : { name }) } });

describe("the pipeline", () => {
  it("puts leads and quotes in their stages, with each lead's quote standing in for it", async () => {
    await lead({ firstName: "Nia", organization: "Nia's Gym", estimatedValue: new Prisma.Decimal(500), ownerId: t.staff.id });
    const q = await lead({ firstName: "Quin" });
    await t.db.lead.update({ where: { id: q }, data: { status: "QUALIFIED" } });
    const gone = await lead({ firstName: "Old" });
    await t.db.lead.update({ where: { id: gone }, data: { status: "LOST", updatedAt: new Date(Date.now() - 100 * 86_400_000) } });

    const draft = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id, title: "Hoodies" });
    await lead({ firstName: "Has", lastName: "Quote" }).then((id) => t.db.lead.update({ where: { id }, data: { quoteId: draft } }));
    const sent = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: null });
    await t.db.order.update({ where: { id: sent }, data: { statusId: (await status("QUOTE_SENT")).id } });
    const declined = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: null });
    await t.db.order.update({ where: { id: declined }, data: { statusId: (await status(null, "Declined")).id } });
    const won = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    await addLine(t.db, won, t.line(12), t.staff.id);
    await t.db.order.update({ where: { id: won }, data: { statusId: (await status("QUOTE_APPROVED")).id } });
    await convertQuote(t.db, won, t.staff.id);

    const cards = await loadPipeline(t.db, { days: 30 });
    const where = Object.fromEntries(cards.map((c) => [c.kind === "lead" ? c.title : c.id, c.stage]));
    expect(where).toEqual({ "Nia's Gym": "NEW", Quin: "CONTACTED", [draft]: "QUOTING", [sent]: "SENT", [declined]: "LOST", [won]: "WON" });
    expect(cards.find((c) => c.id === draft)?.note).toBe("From a lead");
    expect(cards.find((c) => c.title === "Quin")?.note).toBe("Qualified");
    expect(winRate(cards)).toMatchObject({ won: 1, lost: 1, rate: 0.5 });

    // One person's board: their leads and the quotes assigned to them.
    const mine = await loadPipeline(t.db, { days: 30, ownerId: t.staff.id });
    expect(mine.map((c) => c.stage).sort()).toEqual(["NEW", "QUOTING", "WON"]);
  });

  it("moves leads between New, Contacted and Lost, keeping a qualified lead qualified", async () => {
    const id = await lead({ firstName: "Mo" });
    await setLeadStatus(t.db, id, "CONTACTED", null, t.staff.id);
    await t.db.lead.update({ where: { id }, data: { status: "QUALIFIED" } });
    await setLeadStatus(t.db, id, "CONTACTED", null, t.staff.id);
    expect((await t.db.lead.findUniqueOrThrow({ where: { id } })).status).toBe("QUALIFIED");
    await setLeadStatus(t.db, id, "LOST", "  Too expensive ", t.staff.id);
    expect(await t.db.lead.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "LOST", lostReason: "Too expensive" });
    const events = await t.db.leadEvent.findMany({ where: { leadId: id, type: "STATUS" }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.body)).toEqual(["Status: New → Contacted", "Status: Qualified → Lost (Too expensive)"]);
  });
});
