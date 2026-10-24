// Store owners' commission: worked out at checkout, earned once paid, paid out by staff.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setUpBusiness } from "@/lib/platform/setup";
import { makeTestBusiness } from "@/test/fixtures";
import { placeOrderFromCart } from "./checkout";
import { commissionFor, commissionLabel, commissionSummary } from "./commissions";
import { createStoreItem } from "./items";
import { createAffiliateStore } from "./stores";

const D = (v: string | number) => new Prisma.Decimal(v);

describe("working out commission", () => {
  const sale = { merchandise: D("100.00"), discount: D("10.00"), pieces: 4 };
  it("is a percentage of sales after discounts, or an amount per piece", () => {
    expect(commissionFor({ commissionKind: "PERCENT", commissionValue: D("12.5") }, sale).toFixed(2)).toBe("11.25");
    expect(commissionFor({ commissionKind: "PER_PIECE", commissionValue: D("1.50") }, sale).toFixed(2)).toBe("6.00");
    expect(commissionFor({ commissionKind: null, commissionValue: null }, sale).toFixed(2)).toBe("0.00");
    expect(commissionLabel({ commissionKind: "PERCENT", commissionValue: D("10") })).toBe("10% of sales");
  });
});

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let storeId = "";
let itemId = "";

beforeAll(async () => {
  t = await makeTestBusiness(`comm-${Date.now()}`);
  await setUpBusiness(t.db);
  storeId = (await createAffiliateStore(t.db, { name: "Booster Club", slug: `boosters-${Date.now()}`, customerId: t.customer.id })).id;
  await t.db.store.update({ where: { id: storeId }, data: { commissionKind: "PERCENT", commissionValue: 10 } });
  itemId = await createStoreItem(t.db, storeId, {
    name: "Tee",
    description: null,
    productId: t.product.id,
    colorId: t.product.colors[0].id,
    sizeIds: [t.product.sizes[0].id],
    decorations: [{ methodId: t.method.id, location: "Front", colors: 1 }],
    batchQty: 24,
  });
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

async function buy(qty: number, paid: boolean) {
  const pickup = await t.db.deliveryMethod.findFirstOrThrow({ where: { kind: "PICKUP" } });
  const cart = await t.db.cart.create({
    data: {
      businessId: t.business.id,
      storeId,
      tokenHash: `c-${Math.random()}`,
      email: "fan@example.com",
      firstName: "Fan",
      deliveryMethodId: pickup.id,
      items: { create: { storeItemId: itemId, sizeId: t.product.sizes[0].id, qty } },
    },
  });
  const total = (await t.db.storeItemPrice.findFirstOrThrow({ where: { itemId } })).basePrice.times(qty);
  return placeOrderFromCart(t.db, cart.id, paid ? { amount: total, reference: `pi_${Math.random()}` } : null, "http://boosters.localhost:3000");
}

describe("a store's commission", () => {
  it("is kept on each order, earned when paid, and owed until paid out", async () => {
    const paid = await buy(3, true); // 3 × 11.67 = 35.01 → 3.50
    await buy(1, false); // 11.67 → 1.17, pending
    const cancelled = await buy(2, true);
    const cancel = await t.db.orderStatus.findFirstOrThrow({ where: { type: "ORDER", name: "Cancelled" } });
    await t.db.order.update({ where: { id: cancelled.id }, data: { statusId: cancel.id } });
    expect((await t.db.order.findUniqueOrThrow({ where: { id: paid.id } })).commission.toFixed(2)).toBe("3.50");

    // A new rate only applies to new orders.
    await t.db.store.update({ where: { id: storeId }, data: { commissionValue: 50 } });
    await t.db.commissionPayout.create({ data: { businessId: t.business.id, storeId, amount: "2.00", paidOn: new Date("2026-11-01") } });

    const s = await commissionSummary(t.db, storeId);
    expect(s.orders).toHaveLength(2);
    expect([s.earned, s.pending, s.paidOut, s.owed].map((d) => d.toFixed(2))).toEqual(["3.50", "1.17", "2.00", "1.50"]);
  });
});
