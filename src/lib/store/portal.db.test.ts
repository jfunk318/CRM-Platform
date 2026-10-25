// The store owner portal: who can open it, what it shows, and requests.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setUpBusiness } from "@/lib/platform/setup";
import { makeTestBusiness } from "@/test/fixtures";
import { newRequestCounts, portalData, portalRole, postToSlack, quoteFromRequest, submitStoreRequest, updateStoreRequest } from "./portal";
import { createAffiliateStore } from "./stores";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
const origin = "http://tigers.companyname.localhost:3000";

beforeAll(async () => {
  t = await makeTestBusiness(`portal-${Date.now()}`);
  await setUpBusiness(t.db);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const newStore = (name: string) => createAffiliateStore(t.db, { name, slug: `${name.toLowerCase()}-${Date.now()}`, customerId: t.customer.id });

describe("owner portal access", () => {
  it("lets in the store's customer and contacts with access, nobody else", async () => {
    const store = await newStore("Tigers");
    const coach = await t.db.customer.create({ data: { businessId: t.business.id, firstName: "Coach", email: "Coach@Example.com" } });
    const parent = await t.db.customer.create({ data: { businessId: t.business.id, firstName: "Parent", email: "parent@example.com" } });
    const helper = await t.db.customer.create({ data: { businessId: t.business.id, firstName: "Helper", email: "helper@example.com" } });
    await t.db.storeContact.createMany({
      data: [
        { businessId: t.business.id, storeId: store.id, customerId: coach.id, title: "Head coach" },
        { businessId: t.business.id, storeId: store.id, customerId: helper.id, canManage: false },
      ],
    });
    // The coach signed in once as a second customer record with the same email.
    const coachAgain = await t.db.customer.create({ data: { businessId: t.business.id, firstName: "C", email: "coach@example.com" } });
    expect(await portalRole(t.db, store, t.customer)).toBe("owner");
    expect(await portalRole(t.db, store, coach)).toBe("contact");
    expect(await portalRole(t.db, store, coachAgain)).toBe("contact");
    expect(await portalRole(t.db, store, helper)).toBeNull();
    expect(await portalRole(t.db, store, parent)).toBeNull();
    expect(await portalRole(t.db, store, null)).toBeNull();
    const main = await t.db.store.findFirstOrThrow({ where: { kind: "ROOT" } });
    expect(await portalRole(t.db, { ...main, customerId: t.customer.id }, t.customer)).toBeNull();
  });

  it("shows only the sections the store turned on", async () => {
    const store = await t.db.store.update({ where: { id: (await newStore("Owls")).id }, data: { portalSections: ["orders", "requests"] } });
    const d = await portalData(t.db, store);
    expect(d.orders).toEqual([]);
    expect(d.requests).toEqual([]);
    expect([d.sales, d.codes, d.commission]).toEqual([null, null, null]);
  });
});

describe("store requests", () => {
  it("are flagged as new, emailed to staff and can become a draft quote", async () => {
    const store = await newStore("Hawks");
    const r = await submitStoreRequest(t.db, store, t.customer, { subject: " Add hoodies ", body: "Navy hoodies with the same logo, please." }, `http://${store.slug}.companyname.localhost:3000`);
    expect(r).toMatchObject({ subject: "Add hoodies", status: "NEW" });
    expect((await newRequestCounts(t.db)).get(store.id)).toBe(1);
    const alert = await t.db.emailMessage.findFirstOrThrow({ where: { subject: "Request from Hawks: Add hoodies" } });
    expect(alert.to).toBe("shop@example.com");
    // The link goes to the back office on the business's address, not the store's.
    expect(alert.text).toContain(`http://companyname.localhost:3000/admin/stores/${store.id}/requests`);

    const quoteId = await quoteFromRequest(t.db, r.id, t.staff.id);
    expect(await quoteFromRequest(t.db, r.id, t.staff.id)).toBe(quoteId);
    const quote = await t.db.order.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote).toMatchObject({ type: "QUOTE", customerId: t.customer.id, storeId: store.id, title: "Hawks: Add hoodies" });
    expect((await t.db.storeRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("IN_PROGRESS");
    expect((await newRequestCounts(t.db)).get(store.id)).toBeUndefined();
  });

  it("emails the owner when staff answer (once per new answer)", async () => {
    const store = await newStore("Bears");
    const r = await submitStoreRequest(t.db, store, t.customer, { subject: "Reorder", body: "Same as last year" }, origin);
    expect(await updateStoreRequest(t.db, r.id, { status: "IN_PROGRESS", reply: null }, origin)).toBe(false);
    expect(await updateStoreRequest(t.db, r.id, { status: "DONE", reply: "Done! New items are up." }, origin)).toBe(true);
    expect(await updateStoreRequest(t.db, r.id, { status: "DONE", reply: "Done! New items are up." }, origin)).toBe(false);
    const mail = await t.db.emailMessage.findFirstOrThrow({ where: { to: t.customer.email!, subject: "Re: Reorder (Bears)" } });
    expect(mail.text).toContain(`${origin}/owner?tab=requests`);
  });

  it("makes the quote straight away when the store asks for that, and refuses empty requests", async () => {
    const store = await t.db.store.update({ where: { id: (await newStore("Lions")).id }, data: { requestQuotes: true } });
    const r = await submitStoreRequest(t.db, store, t.customer, { subject: "Banners", body: "Two 3x6 banners" }, origin);
    expect((await t.db.storeRequest.findUniqueOrThrow({ where: { id: r.id } })).quoteId).not.toBeNull();
    await expect(submitStoreRequest(t.db, store, t.customer, { subject: "x", body: "  " }, origin)).rejects.toThrow(/Say what you need/);
  });

  it("skips Slack when no webhook is set", async () => {
    expect(await postToSlack(null, "hi")).toBe(false);
  });
});
