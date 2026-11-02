// A store's setup from the webstore dialog: commission, delivery, look, or copied from another store.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { applyStoreSetup, copyStoreSetup } from "./setup";
import { createAffiliateStore } from "./stores";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`setup-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

describe("store setup", () => {
  it("sets commission, delivery options and look, and checks them", async () => {
    const store = await createAffiliateStore(t.db, { name: "Setup A", slug: `setup-a-${Date.now()}` });
    const methods = await Promise.all(
      ["Pickup", "Ship"].map((name, i) => t.db.deliveryMethod.create({ data: { businessId: t.business.id, name, kind: i ? "SHIP" : "PICKUP", price: 0 } })),
    );
    await applyStoreSetup(t.db, store.id, { commission: { kind: "PER_PIECE", value: new Prisma.Decimal(2) }, deliveryMethodIds: [methods[1].id], heroArt: "lines", accentColor: "#123456" });
    const s = await t.db.store.findUniqueOrThrow({ where: { id: store.id }, include: { deliveryMethods: true } });
    expect(s).toMatchObject({ commissionKind: "PER_PIECE", heroArt: "lines", accentColor: "#123456", customDeliveryMethods: true });
    expect(s.commissionValue?.toNumber()).toBe(2);
    expect(s.deliveryMethods.map((d) => d.deliveryMethodId)).toEqual([methods[1].id]);

    // No commission and every delivery method.
    await applyStoreSetup(t.db, store.id, { commission: null, deliveryMethodIds: null });
    expect(await t.db.store.findUniqueOrThrow({ where: { id: store.id } })).toMatchObject({ commissionKind: null, customDeliveryMethods: false });
    await expect(applyStoreSetup(t.db, store.id, { commission: { kind: "PERCENT", value: new Prisma.Decimal(150) } })).rejects.toThrow(/between 0 and 100/);
    await expect(applyStoreSetup(t.db, store.id, { deliveryMethodIds: [] })).rejects.toThrow(/at least one/);
  });

  it("copies another store's setup and pages, not its items", async () => {
    const from = await createAffiliateStore(t.db, { name: "Template", slug: `tmpl-${Date.now()}`, theme: "sports" });
    await t.db.store.update({ where: { id: from.id }, data: { commissionKind: "PERCENT", commissionValue: 10, announcement: "Orders close Friday", designerEnabled: true } });
    await t.db.storePage.create({ data: { businessId: t.business.id, storeId: from.id, slug: "sizing", title: "Sizing" } });
    const to = await createAffiliateStore(t.db, { name: "Copy", slug: `copy-${Date.now()}` });
    await copyStoreSetup(t.db, from.id, to.id);
    const s = await t.db.store.findUniqueOrThrow({ where: { id: to.id }, include: { pages: true, items: true } });
    expect(s).toMatchObject({ name: "Copy", theme: "sports", commissionKind: "PERCENT", announcement: "Orders close Friday", designerEnabled: true });
    expect(s.pages.map((p) => p.slug).sort()).toEqual(["home", "sizing"]);
    expect(s.items).toEqual([]);
  });
});
