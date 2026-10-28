// Publishing a quote's/order's items to a store.
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { saveUpload } from "@/lib/files/storage";
import { addLine, createOrder, OrderError, updateLine } from "@/lib/orders/service";
import { makeTestBusiness } from "@/test/fixtures";
import { publishToStore } from "./publish";
import { createAffiliateStore, freeStoreSlug, StoreError } from "./stores";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let orderId = "";
let lineId = "";
let storeId = "";
let areaId = "";

beforeAll(async () => {
  t = await makeTestBusiness(`pub-${Date.now()}`);
  const view = await t.db.productView.create({ data: { businessId: t.business.id, productId: t.product.id, name: "Front" } });
  areaId = (await t.db.decorationArea.create({ data: { businessId: t.business.id, viewId: view.id, name: "Full Front", widthIn: 10, heightIn: 10, x: 0.25, y: 0.25, w: 0.5, h: 0.5 } })).id;
  orderId = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
  lineId = await addLine(t.db, orderId, t.line(12), t.staff.id);
  storeId = (await createAffiliateStore(t.db, { name: "Tigers Football", slug: null, customerId: t.customer.id })).id;
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const items = () => t.db.storeItem.findMany({ where: { storeId }, include: { prices: true }, orderBy: { createdAt: "asc" } });
const events = () => t.db.orderEvent.findMany({ where: { orderId, type: "STORE" } });

describe("publishing to a store", () => {
  it("adds each item with the line's design, every size of its color, priced at the quantity ordered", async () => {
    expect(await publishToStore(t.db, orderId, { storeId, mode: "update", staffId: t.staff.id })).toEqual({ added: 1, updated: 0, removed: 0 });
    const [item] = await items();
    const line = await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId } });
    expect(item).toMatchObject({ name: "Tee", designId: line.designId, sourceLineId: lineId, imageFileId: null });
    expect(item.prices.map((p) => p.sizeId)).toEqual([t.product.sizes[0].id]);
    // $10 each (garment + print) plus $40 of one-time fees spread over the 12 ordered.
    expect(item.prices[0].basePrice.toFixed(2)).toBe("13.33");
    expect((await events())[0].body).toBe("Published to Tigers Football (1 added)");
  });

  it("updates the same item when published again, keeping price overrides; a batch quantity changes base prices", async () => {
    const [before] = await items();
    await t.db.storeItemPrice.update({ where: { id: before.prices[0].id }, data: { overridePrice: 15 } });
    await t.db.storeItem.update({ where: { id: before.id }, data: { name: "Tigers Tee" } });
    expect(await publishToStore(t.db, orderId, { storeId, mode: "update", batchQty: 24, staffId: t.staff.id })).toEqual({ added: 0, updated: 1, removed: 0 });
    const [after] = await items();
    expect(after).toMatchObject({ id: before.id, name: "Tigers Tee" });
    expect(after.prices[0].basePrice.toFixed(2)).toBe("11.67"); // fees over 24
    expect(after.prices[0].overridePrice?.toFixed(2)).toBe("15.00");
  });

  it("follows the line's design after the order is edited, and makes the mockup the item's picture", async () => {
    const png = await sharp({ create: { width: 200, height: 100, channels: 4, background: "#ff0000" } }).png().toBuffer();
    const file = await saveUpload(t.db, new File([new Uint8Array(png)], "logo.png", { type: "image/png" }), t.staff.id);
    const line = t.line(12);
    const artwork = { artworkFileId: file.id, sourceFileId: null, edits: {}, widthPx: 200, heightPx: 100, x: 0, y: 0, w: 1, rotation: 0 };
    await updateLine(t.db, lineId, { ...line, decorations: [{ ...line.decorations[0], areaId, location: "Front / Full Front", artwork }] }, t.staff.id);
    const edited = await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId } });
    const [before] = await items();
    // The store item shared the design, so editing the line gave the line its own copy.
    expect(edited.designId).not.toBe(before.designId);
    await publishToStore(t.db, orderId, { storeId, mode: "update", staffId: t.staff.id });
    const [after] = await items();
    expect(after).toMatchObject({ designId: edited.designId, imageIsMockup: true });
    const picture = await t.db.storedFile.findUniqueOrThrow({ where: { id: after.imageFileId! } });
    expect(picture.name).toBe("Tigers Tee Front mockup.png");
  });

  it("keeps a picture staff uploaded", async () => {
    const [item] = await items();
    const own = await saveUpload(t.db, new File([new Uint8Array(await sharp({ create: { width: 10, height: 10, channels: 3, background: "#00f" } }).png().toBuffer())], "photo.png", { type: "image/png" }), t.staff.id);
    await t.db.storeItem.update({ where: { id: item.id }, data: { imageFileId: own.id, imageIsMockup: false } });
    await publishToStore(t.db, orderId, { storeId, mode: "update", staffId: t.staff.id });
    expect((await items())[0].imageFileId).toBe(own.id);
  });

  it("overwrites: takes out what the store had (orders keep their lines), then adds", async () => {
    const [old] = await items();
    const other = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
    const sold = await addLine(t.db, other, t.line(12), t.staff.id);
    await t.db.orderLine.update({ where: { id: sold }, data: { storeItemId: old.id } });
    expect(await publishToStore(t.db, orderId, { storeId, mode: "overwrite", staffId: t.staff.id })).toEqual({ added: 1, updated: 0, removed: 1 });
    const now = await items();
    expect(now).toHaveLength(1);
    expect(now[0].id).not.toBe(old.id);
    expect((await t.db.orderLine.findUniqueOrThrow({ where: { id: sold } })).storeItemId).toBeNull();
  });

  it("refuses colors with no sizes for sale, and changes nothing", async () => {
    const color = await t.db.productColor.create({ data: { businessId: t.business.id, productId: t.product.id, name: "Red" } });
    const variant = await t.db.productVariant.create({ data: { businessId: t.business.id, productId: t.product.id, colorId: color.id, sizeId: t.product.sizes[0].id, sku: "T1-RED-M", wholesaleCost: 5 } });
    const red = await addLine(t.db, orderId, { ...t.line(12), colorId: color.id }, t.staff.id);
    await t.db.productVariant.update({ where: { id: variant.id }, data: { active: false } });
    await expect(publishToStore(t.db, orderId, { storeId, mode: "overwrite", staffId: t.staff.id })).rejects.toThrow(/Red has no sizes/);
    expect(await items()).toHaveLength(1);
    await expect(publishToStore(t.db, orderId, { storeId, mode: "update", lineIds: [], staffId: t.staff.id })).rejects.toThrow(OrderError);
    await t.db.orderLine.delete({ where: { id: red } });
  });
});

describe("new stores", () => {
  it("start with the chosen theme and an empty home page (the banner shows the name)", async () => {
    const store = await createAffiliateStore(t.db, { name: "Owls", slug: `owls-${Date.now()}`, theme: "luxury" });
    expect(store).toMatchObject({ theme: "luxury", showHero: true });
    expect((await t.db.storePage.findFirstOrThrow({ where: { storeId: store.id, slug: "home" } })).body).toBe("");
    expect((await createAffiliateStore(t.db, { name: "Hawks", slug: `hawks-${Date.now()}`, theme: "neon" })).theme).toBe("minimal");
  });
});

describe("store addresses", () => {
  it("suggests a free address and refuses taken or reserved ones", async () => {
    expect(await freeStoreSlug(t.db, "Tigers Football")).toBe("tigers-football-2");
    expect(await freeStoreSlug(t.db, "Admin")).toBe("admin-2");
    await expect(createAffiliateStore(t.db, { name: "X", slug: "tigers-football" })).rejects.toThrow(StoreError);
    await expect(createAffiliateStore(t.db, { name: "X", slug: "www" })).rejects.toThrow(/reserved/);
  });
});
