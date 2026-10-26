// Leads: adding, duplicates, contact, converting, and website quote requests.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setUpBusiness } from "@/lib/platform/setup";
import { createQuoteRequest } from "@/lib/store/quote-request";
import type { RequestStore } from "@/lib/store/resolve";
import { makeTestBusiness } from "@/test/fixtures";
import { convertLead, createLead, type LeadInput, leadSummary, logContact, possibleDuplicates, updateLead } from "./leads";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`leads-${Date.now()}`);
  await setUpBusiness(t.db);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const input = (p: Partial<LeadInput> = {}): LeadInput => ({
  firstName: "Jordan",
  lastName: "Lee",
  organization: "Westfield Soccer Club",
  title: "Equipment manager",
  email: "Jordan@Westfield.org",
  phone: "(413) 555-0101",
  source: "Trade show",
  interest: "Spring uniforms, about 60 pieces",
  estimatedValue: new Prisma.Decimal("1800"),
  ownerId: null,
  ...p,
});

describe("leads", () => {
  let leadId = "";

  it("are added with their details cleaned up and a timeline", async () => {
    leadId = await createLead(t.db, input({ firstName: "  Jordan ", ownerId: t.staff.id }), t.staff.id);
    const lead = await t.db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { events: true } });
    expect(lead).toMatchObject({ firstName: "Jordan", email: "jordan@westfield.org", status: "NEW", ownerId: t.staff.id });
    expect(lead.events.map((e) => [e.type, e.body])).toEqual([["CREATED", "Lead added (Trade show)"]]);
    await expect(createLead(t.db, input({ firstName: " " }), null)).rejects.toThrow(/first name/);
    await expect(createLead(t.db, input({ email: "nope" }), null)).rejects.toThrow(/email/);
  });

  it("finds people already on file by email or phone", async () => {
    await t.db.customer.create({ data: { businessId: t.business.id, firstName: "J", lastName: "Lee", phone: "413-555-0101" } });
    const d = await possibleDuplicates(t.db, { email: "JORDAN@westfield.org", phone: null });
    expect(d.leads.map((l) => l.id)).toEqual([leadId]);
    expect((await possibleDuplicates(t.db, { email: null, phone: "+1 413 555 0101" })).customers).toHaveLength(1);
    expect((await possibleDuplicates(t.db, { email: "jordan@westfield.org", phone: null }, leadId)).leads).toEqual([]);
  });

  it("moves to Contacted on the first call, and notes status and owner changes", async () => {
    await logContact(t.db, leadId, "CALL", "Wants samples by Friday", t.staff.id);
    let lead = await t.db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe("CONTACTED");
    expect(lead.lastContactAt).not.toBeNull();
    await updateLead(t.db, leadId, { ...input(), status: "QUALIFIED", ownerId: null }, t.staff.id);
    lead = await t.db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.status).toBe("QUALIFIED");
    const last = await t.db.leadEvent.findFirstOrThrow({ where: { leadId }, orderBy: { createdAt: "desc" } });
    expect(last.body).toBe("Status: Contacted → Qualified\nOwner: nobody");
    await expect(updateLead(t.db, leadId, { ...input(), status: "CONVERTED" }, null)).rejects.toThrow(/Convert/);
    expect((await leadSummary(t.db)).openValue.toFixed(2)).toBe("1800.00");
  });

  it("converts into a customer with a company and a draft quote", async () => {
    const r = await convertLead(t.db, leadId, { makeQuote: true }, t.staff.id);
    const customer = await t.db.customer.findUniqueOrThrow({ where: { id: r.customerId }, include: { company: true } });
    expect(customer).toMatchObject({ firstName: "Jordan", email: "jordan@westfield.org" });
    expect(customer.company?.name).toBe("Westfield Soccer Club");
    const quote = await t.db.order.findUniqueOrThrow({ where: { id: r.quoteId! } });
    expect(quote).toMatchObject({ type: "QUOTE", customerId: customer.id, title: "Spring uniforms, about 60 pieces" });
    expect(await t.db.lead.findUniqueOrThrow({ where: { id: leadId } })).toMatchObject({ status: "CONVERTED", customerId: customer.id, quoteId: quote.id });
    // Converting again changes nothing.
    expect(await convertLead(t.db, leadId, { makeQuote: true }, t.staff.id)).toEqual(r);
  });

  it("matches the existing customer and company instead of adding new ones", async () => {
    const company = await t.db.company.create({ data: { businessId: t.business.id, name: "Ridge High" } });
    const existing = await t.db.customer.create({ data: { businessId: t.business.id, firstName: "Sam", email: "sam@ridge.edu" } });
    const id = await createLead(t.db, input({ firstName: "Sam", email: "SAM@ridge.edu", organization: "ridge high", phone: null }), null);
    const r = await convertLead(t.db, id, { makeQuote: false }, null);
    expect(r).toEqual({ customerId: existing.id, quoteId: null });
    expect((await t.db.customer.findUniqueOrThrow({ where: { id: existing.id } })).companyId).toBe(company.id);
    expect(await t.db.company.count({ where: { name: { equals: "Ridge High", mode: "insensitive" } } })).toBe(1);
  });
});

describe("website quote requests", () => {
  const request = async (email: string) => {
    const store = await t.db.store.findFirstOrThrow({ where: { kind: "ROOT" } });
    const rs = { db: t.db, business: t.business, store } as unknown as RequestStore;
    return createQuoteRequest(rs, { name: "Riley Park", email, phone: null, organization: "Park Lacrosse", details: "40 hoodies", neededBy: null, product: null, files: [], origin: "http://companyname.localhost:3000" });
  };

  it("make a lead for newcomers, linked to their customer and quote", async () => {
    const quote = await request("riley@park.org");
    const lead = await t.db.lead.findFirstOrThrow({ where: { email: "riley@park.org" } });
    expect(lead).toMatchObject({ source: "Website quote request", status: "NEW", organization: "Park Lacrosse", interest: "40 hoodies", quoteId: quote.id, customerId: quote.customerId });
  });

  it("don't for customers who have ordered before", async () => {
    await t.db.customer.update({ where: { id: t.customer.id }, data: { email: "pat@example.com" } });
    const orderStatus = await t.db.orderStatus.findFirstOrThrow({ where: { type: "ORDER", isDefault: true } });
    await t.db.order.create({ data: { businessId: t.business.id, type: "ORDER", number: 9001, customerId: t.customer.id, statusId: orderStatus.id } });
    await request("pat@example.com");
    expect(await t.db.lead.count({ where: { email: "pat@example.com" } })).toBe(0);
  });
});
