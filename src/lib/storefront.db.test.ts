// Store items, cart totals, codes and placing orders from a cart, against
// the database in DATABASE_URL, inside throwaway businesses.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { setUpBusiness } from "@/lib/platform/setup";
import { repriceOrder } from "@/lib/orders/pricing";
import { updateLine } from "@/lib/orders/service";
import { cartTotals, findCartById, promoProblem } from "@/lib/store/cart";
import { hostTarget } from "@/lib/business";
import { placeOrderFromCart } from "@/lib/store/checkout";
import { createStoreItem } from "@/lib/store/items";
import { createQuoteRequest } from "@/lib/store/quote-request";
import { effectiveSettings, itemPrice, storeStatus } from "@/lib/store/settings";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
const origin = "http://shop.localhost:3000";
const D = (v: string) => new Prisma.Decimal(v);

beforeAll(async () => {
  t = await makeTestBusiness(`store-${Date.now()}`);
  await setUpBusiness(t.db);
  await t.db.taxRate.create({ data: { businessId: t.business.id, name: "MA", rate: "0.0625", region: "MA" } });
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const rootStore = () => t.db.store.findFirstOrThrow({ where: { kind: "ROOT" } });

describe("store setup and settings", () => {
  it("gives every business a root store with a home page", async () => {
    const store = await rootStore();
    expect(store.name).toBe(t.business.name);
    expect(await t.db.storePage.count({ where: { storeId: store.id, slug: "home" } })).toBe(1);
  });

  it("inherits business defaults unless the store sets its own", async () => {
    const store = await rootStore();
    const business = await t.db.business.findUniqueOrThrow({ where: { id: t.business.id } });
    expect(effectiveSettings(business, store)).toMatchObject({ accountMode: "OPTIONAL", showPrices: true, allowPayLater: false });
    expect(effectiveSettings(business, { ...store, accountMode: "GUEST_ONLY", showPrices: false })).toMatchObject({ accountMode: "GUEST_ONLY", showPrices: false });
  });

  it("adds markups as an amount or a percentage, item first, then store", () => {
    const price = { basePrice: D("10.00"), overridePrice: null };
    const none = { markupKind: null, markupValue: null };
    expect(itemPrice(price, none, none).toFixed(2)).toBe("10.00");
    expect(itemPrice(price, none, { markupKind: "PERCENT", markupValue: D("20") }).toFixed(2)).toBe("12.00");
    expect(itemPrice({ ...price, overridePrice: D("9.00") }, { markupKind: "AMOUNT", markupValue: D("5") }, { markupKind: "PERCENT", markupValue: D("20") }).toFixed(2)).toBe("14.00");
  });
});

describe("selling from the store", () => {
  let itemId = "";
  let cartId = "";

  it("prices an item per size as part of a batch, spreading setup fees", async () => {
    const store = await rootStore();
    itemId = await createStoreItem(t.db, store.id, {
      name: "Team Tee",
      description: null,
      productId: t.product.id,
      colorId: t.product.colors[0].id,
      sizeIds: [t.product.sizes[0].id],
      decorations: [{ methodId: t.method.id, location: "Front", colors: 1 }],
      batchQty: 24,
    });
    const item = await t.db.storeItem.findUniqueOrThrow({ where: { id: itemId }, include: { prices: true } });
    // Blank 5.00 × 1.40 = 7.00, print 3.00, two screens (white underbase on navy) 40.00 / 24 = 1.67.
    expect(item.prices.map((p) => p.basePrice.toFixed(2))).toEqual(["11.67"]);
    expect(item.slug).toBe("team-tee");
  });

  it("totals a cart with a promo, delivery, tax and a gift code", async () => {
    const store = await rootStore();
    const method = await t.db.deliveryMethod.findFirstOrThrow({ where: { kind: "SHIP" } });
    await t.db.deliveryMethod.update({ where: { id: method.id }, data: { price: "8.00" } });
    const promo = await t.db.promoCode.create({ data: { businessId: t.business.id, code: "TEAM10", kind: "PERCENT", value: "10" } });
    const gift = await t.db.giftCode.create({ data: { businessId: t.business.id, code: "GIFT-1", initialAmount: "10", balance: "10" } });
    const cart = await t.db.cart.create({
      data: {
        businessId: t.business.id,
        storeId: store.id,
        tokenHash: `test-${Date.now()}`,
        email: "Jo@Example.com",
        firstName: "Jo",
        lastName: "Fan",
        deliveryMethodId: method.id,
        shipLine1: "1 Main St",
        shipCity: "Boston",
        shipRegion: "MA",
        shipPostalCode: "02101",
        promoCodeId: promo.id,
        giftCodeId: gift.id,
        items: { create: { storeItemId: itemId, sizeId: t.product.sizes[0].id, qty: 3 } },
      },
    });
    cartId = cart.id;
    const totals = await cartTotals(t.db, { business: t.business, store }, (await findCartById(t.db, cart.id))!);
    expect(totals.merchandise.toFixed(2)).toBe("35.01");
    expect(totals.discount.toFixed(2)).toBe("3.50");
    expect(totals.shipping.toFixed(2)).toBe("8.00");
    // (35.01 − 3.50) × 6.25% = 1.97
    expect(totals.tax.toFixed(2)).toBe("1.97");
    expect(totals.total.toFixed(2)).toBe("41.48");
    expect(totals.gift.toFixed(2)).toBe("10.00");
    expect(totals.amountDue.toFixed(2)).toBe("31.48");
  });

  it("places the order once, at the store's prices, with payments recorded", async () => {
    const order = await placeOrderFromCart(t.db, cartId, { amount: D("31.48"), reference: "pi_test_1" }, origin);
    const again = await placeOrderFromCart(t.db, cartId, { amount: D("31.48"), reference: "pi_test_1" }, origin);
    expect(again.id).toBe(order.id);
    const o = await t.db.order.findUniqueOrThrow({ where: { id: order.id }, include: { lines: { include: { sizes: true } }, payments: true, customer: true, productionJobs: true, status: true } });
    expect(o.source).toBe("STOREFRONT");
    expect(o.total.toFixed(2)).toBe("41.48");
    expect(o.paidTotal.toFixed(2)).toBe("41.48");
    expect(o.payments.map((p) => [p.method, p.amount.toFixed(2)]).sort()).toEqual([["GIFT_CARD", "10.00"], ["ONLINE", "31.48"]]);
    expect(o.lines[0].fixedPrice).toBe(true);
    expect(o.lines[0].sizes[0].unitPrice.toFixed(2)).toBe("11.67");
    expect(o.customer.email).toBe("jo@example.com");
    expect(o.approvedAt).not.toBeNull();
    expect(o.productionJobs).toHaveLength(1);
    expect((await t.db.promoCode.findFirstOrThrow({ where: { code: "TEAM10" } })).usedCount).toBe(1);
    expect((await t.db.giftCode.findFirstOrThrow({ where: { code: "GIFT-1" } })).balance.toFixed(2)).toBe("0.00");
    expect(await t.db.emailMessage.count({ where: { orderId: o.id, to: "jo@example.com" } })).toBe(1);
  });

  it("keeps store prices when the order is repriced, even if the item changes", async () => {
    const o = await t.db.order.findFirstOrThrow({ where: { source: "STOREFRONT" } });
    await t.db.storeItemPrice.updateMany({ where: { itemId }, data: { basePrice: "99.00" } });
    await repriceOrder(t.db, o.id);
    expect((await t.db.order.findUniqueOrThrow({ where: { id: o.id } })).total.toFixed(2)).toBe("41.48");
  });

  it("keeps the store price when staff change quantities, without touching the store item", async () => {
    const o = await t.db.order.findFirstOrThrow({ where: { source: "STOREFRONT" }, include: { lines: { include: { design: { include: { decorations: true } } } } } });
    const line = o.lines[0];
    await updateLine(t.db, line.id, { ...t.line(5), decorations: [{ methodId: t.method.id, location: "Back", colors: 2 }] }, t.staff.id);
    const after = await t.db.orderLine.findUniqueOrThrow({ where: { id: line.id }, include: { sizes: true } });
    expect(after.fixedPrice).toBe(true);
    expect(after.sizes[0].unitPrice.toFixed(2)).toBe("11.67");
    expect(after.designId).not.toBe(line.designId);
    const item = await t.db.storeItem.findUniqueOrThrow({ where: { id: itemId }, include: { design: { include: { decorations: true } } } });
    expect(item.design.decorations.map((d) => d.location)).toEqual(["Front"]);
  });

  it("reuses the customer with that email on the next order", async () => {
    const store = await rootStore();
    const cart = await t.db.cart.create({
      data: { businessId: t.business.id, storeId: store.id, tokenHash: `test2-${Date.now()}`, email: "jo@example.com", firstName: "Jo", items: { create: { storeItemId: itemId, sizeId: t.product.sizes[0].id, qty: 1 } } },
    });
    const order = await placeOrderFromCart(t.db, cart.id, null, origin);
    const first = await t.db.order.findFirstOrThrow({ where: { source: "STOREFRONT" }, orderBy: { number: "asc" } });
    expect(order.customerId).toBe(first.customerId);
    // Not paid: the balance stays on the order.
    expect(order.paidTotal.toFixed(2)).toBe("0.00");
  });
});

describe("quote requests", () => {
  it("lands as a quote with the requested sizes and a note", async () => {
    const store = await rootStore();
    const business = await t.db.business.findUniqueOrThrow({ where: { id: t.business.id } });
    const rs = { business, db: t.db, store: { ...store, deliveryMethods: [], logo: null, group: null }, settings: effectiveSettings(business, store), status: storeStatus(store) };
    const quote = await createQuoteRequest(rs, {
      name: "Sam Coach",
      email: "sam@team.example",
      phone: null,
      organization: "Lincoln Hockey",
      details: "Logo on the front",
      neededBy: null,
      product: { productId: t.product.id, colorId: t.product.colors[0].id, quantities: { [t.product.sizes[0].id]: 20 } },
      files: [],
      origin,
    });
    const q = await t.db.order.findUniqueOrThrow({ where: { id: quote.id }, include: { lines: { include: { sizes: true } }, events: true, customer: true } });
    expect(q.type).toBe("QUOTE");
    expect(q.source).toBe("QUOTE_REQUEST");
    expect(q.title).toContain("Lincoln Hockey");
    expect(q.lines[0].sizes[0].qty).toBe(20);
    expect(q.events.some((e) => e.body.includes("Logo on the front"))).toBe(true);
    expect(q.customer.lastName).toBe("Coach");
  });
});

describe("affiliate stores", () => {
  it("takes markup from the group when the store and item don't set one", async () => {
    const group = await t.db.storeGroup.create({ data: { businessId: t.business.id, name: "Teams", markupKind: "AMOUNT", markupValue: "4" } });
    const store = await t.db.store.create({ data: { businessId: t.business.id, kind: "AFFILIATE", slug: "lincoln", name: "Lincoln Hockey", groupId: group.id }, include: { group: true } });
    const price = { basePrice: D("10.00"), overridePrice: null };
    const none = { markupKind: null, markupValue: null };
    expect(itemPrice(price, none, store).toFixed(2)).toBe("14.00");
    expect(itemPrice(price, none, { ...store, markupKind: "PERCENT", markupValue: D("10") }).toFixed(2)).toBe("11.00");
    const business = await t.db.business.findUniqueOrThrow({ where: { id: t.business.id } });
    await t.db.storeGroup.update({ where: { id: group.id }, data: { accountMode: "REQUIRED" } });
    const withGroup = await t.db.store.findUniqueOrThrow({ where: { id: store.id }, include: { group: true } });
    expect(effectiveSettings(business, withGroup, withGroup.group).accountMode).toBe("REQUIRED");
    expect(effectiveSettings(business, { ...withGroup, accountMode: "GUEST_ONLY" }, withGroup.group).accountMode).toBe("GUEST_ONLY");
  });

  it("only accepts a code in the stores it's for", async () => {
    const lincoln = await t.db.store.findFirstOrThrow({ where: { slug: "lincoln" } });
    const root = await rootStore();
    const promo = await t.db.promoCode.create({
      data: { businessId: t.business.id, code: "HOCKEY", kind: "AMOUNT", value: "5", allStores: false, stores: { create: { storeId: lincoln.id } } },
      include: { stores: true },
    });
    expect(promoProblem(promo, D("50"), lincoln.id)).toBeNull();
    expect(promoProblem(promo, D("50"), root.id)).toMatch(/isn't valid in this store/);
  });

  it("finds a store at <store>.<custom domain>", async () => {
    await prisma.business.update({ where: { id: t.business.id }, data: { customDomain: `shop-${t.business.slug}.example` } });
    const target = await hostTarget(`lincoln.shop-${t.business.slug}.example`);
    expect(target.business?.id).toBe(t.business.id);
    expect(target.store).toBe("lincoln");
    expect((await hostTarget(`shop-${t.business.slug}.example`)).store).toBeNull();
    expect((await hostTarget(`a.lincoln.shop-${t.business.slug}.example`)).business).toBeNull();
  });
});
