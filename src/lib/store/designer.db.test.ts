// The online designer: what a store offers, prices for a shopper's design,
// the checks before it goes in the cart, and the order it becomes.
import { Prisma } from "@prisma/client";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { saveUpload } from "@/lib/files/storage";
import { OrderError } from "@/lib/orders/service";
import { setUpBusiness } from "@/lib/platform/setup";
import { makeTestBusiness } from "@/test/fixtures";
import { cartTotals, findCartById } from "./cart";
import { placeOrderFromCart } from "./checkout";
import { checkShopperDesign, designerConfig, designerGarments, designerProduct, shopperPrices } from "./designer";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let areaId = "";
let mine = "";
let theirs = "";
let cartId = "";
const store = () => t.db.store.findFirstOrThrow({ where: { kind: "ROOT" }, include: { group: true } });

beforeAll(async () => {
  t = await makeTestBusiness(`designer-${Date.now()}`);
  await setUpBusiness(t.db);
  const b = t.business.id;
  const view = await t.db.productView.create({ data: { businessId: b, productId: t.product.id, name: "Front" } });
  areaId = (await t.db.decorationArea.create({ data: { businessId: b, viewId: view.id, name: "Full Front", widthIn: 12, heightIn: 14, x: 0.3, y: 0.2, w: 0.4, h: 0.5 } })).id;
  await t.db.viewImage.create({ data: { businessId: b, viewId: view.id, colorId: t.product.colors[0].id, url: "https://example.com/tee.jpg" } });
  const s = await store();
  const cart = await t.db.cart.create({ data: { businessId: b, storeId: s.id, tokenHash: `d-${Date.now()}`, email: "sam@example.com", firstName: "Sam", lastName: "Shopper" } });
  cartId = cart.id;
  const png = async (bg: string) => new Uint8Array(await sharp({ create: { width: 1200, height: 600, channels: 4, background: bg } }).png().toBuffer());
  mine = (await saveUpload(t.db, new File([await png("#ff0000")], "logo.png", { type: "image/png" }), null)).id;
  theirs = (await saveUpload(t.db, new File([await png("#0000ff")], "other.png", { type: "image/png" }), null)).id;
  await t.db.cartFile.create({ data: { businessId: b, cartId, fileId: mine } });
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const art = (fileId: string, w = 0.5) => ({ artworkFileId: fileId, sourceFileId: null, edits: {}, widthPx: 1200, heightPx: 600, x: 0.25, y: 0, w, rotation: 0, coverage: 0.9 });
const deco = (o: Partial<{ fileId: string; w: number; areaId: string; methodId: string }> = {}) => ({
  methodId: o.methodId ?? t.method.id,
  areaId: o.areaId ?? areaId,
  location: "whatever the browser said",
  colors: 2,
  widthIn: 99,
  heightIn: 99,
  artwork: art(o.fileId ?? mine, o.w),
});

describe("what a store's designer offers", () => {
  it("is off until a method is open to shoppers and the store turns it on", async () => {
    expect((await designerConfig(t.db, await store())).enabled).toBe(false);
    await t.db.decorationMethod.update({ where: { id: t.method.id }, data: { shopperDesign: true } });
    expect((await designerConfig(t.db, await store())).enabled).toBe(false);
    await t.db.store.update({ where: { id: (await store()).id }, data: { designerEnabled: true, designerAnyGarment: true } });
    const config = await designerConfig(t.db, await store());
    expect(config).toMatchObject({ enabled: true, upload: true, text: true, library: false });
    expect(config.methods.map((m) => m.id)).toEqual([t.method.id]);
  });

  it("lists garments with a print area and a photo; only the store's own unless any garment is allowed", async () => {
    const s = await store();
    const config = await designerConfig(t.db, s);
    expect((await designerGarments(t.db, s, config)).map((g) => g.slug)).toEqual(["tee"]);
    const product = await designerProduct(t.db, s, config, { slug: "tee" });
    expect(product?.areas).toEqual([expect.objectContaining({ id: areaId, label: "Front / Full Front", widthIn: 12 })]);
    await t.db.store.update({ where: { id: s.id }, data: { designerAnyGarment: false } });
    const narrow = await designerConfig(t.db, await store());
    expect(await designerGarments(t.db, await store(), narrow)).toEqual([]); // the store sells nothing yet
    await t.db.store.update({ where: { id: s.id }, data: { designerAnyGarment: true } });
  });
});

describe("prices and checks", () => {
  it("price the design at the quantity bought, setup spread over the pieces", async () => {
    const s = await store();
    const sizeId = t.product.sizes[0].id;
    const p12 = await shopperPrices(t.db, s, { productId: t.product.id, colorId: t.product.colors[0].id, quantities: { [sizeId]: 12 }, decorations: [{ methodId: t.method.id, location: "Front", colors: 2 }], minQty: 12 });
    const p24 = await shopperPrices(t.db, s, { productId: t.product.id, colorId: t.product.colors[0].id, quantities: { [sizeId]: 24 }, decorations: [{ methodId: t.method.id, location: "Front", colors: 2 }], minQty: 12 });
    // $7 garment (5 + 40%) + $3 print + 3 screens (2 colors and a white underbase on navy) × $20 spread over the pieces.
    expect(p12.unit.get(sizeId)?.toFixed(2)).toBe((7 + 3 + 60 / 12).toFixed(2));
    expect(p24.unit.get(sizeId)!.lt(p12.unit.get(sizeId)!)).toBe(true);
    expect(p12.total?.toFixed(2)).toBe(p12.unit.get(sizeId)!.times(12).toFixed(2));
    // No quantities yet: an example run.
    const ex = await shopperPrices(t.db, s, { productId: t.product.id, colorId: t.product.colors[0].id, quantities: {}, decorations: [{ methodId: t.method.id, location: "Front", colors: 1 }], minQty: 12 });
    expect(ex).toMatchObject({ example: true, qty: 12, total: null });
    await expect(shopperPrices(t.db, s, { productId: t.product.id, colorId: t.product.colors[0].id, quantities: { [sizeId]: 3 }, decorations: [{ methodId: t.method.id, location: "Front", colors: 1 }], minQty: 12 })).rejects.toThrow(/at least 12/);
  });

  it("recompute the size from the placement and refuse artwork that isn't the shopper's", async () => {
    const s = await store();
    const product = (await designerProduct(t.db, s, await designerConfig(t.db, s), { slug: "tee" }))!;
    const check = (d: ReturnType<typeof deco>[], lowResOk = false) => checkShopperDesign(t.db, { product, cartId, libraryFileIds: [], decorations: d as never, lowResOk });
    const [ok] = await check([deco()]);
    // Half the 12″ area, 2:1 art → 6″ × 3″; the location is the area's own.
    expect(ok).toMatchObject({ widthIn: 6, heightIn: 3, location: "Front / Full Front", colors: 2 });
    await expect(check([deco({ fileId: theirs })])).rejects.toThrow(/isn't available/);
    await expect(check([deco({ areaId: "nope0000000" })])).rejects.toThrow(/where your artwork goes/);
    await expect(check([deco({ methodId: "nope0000000" })])).rejects.toThrow(/isn't offered/);
    await expect(check([deco(), deco()])).rejects.toThrow(/one design per spot/);
    // 1200 px across the whole 12″ is 100 DPI: needs the shopper's OK.
    await expect(check([deco({ w: 1 })])).rejects.toThrow(OrderError);
    const [low] = await check([deco({ w: 1 })], true);
    expect(low.notes).toBe("Shopper accepted low resolution");
    // The store's logos can be used when offered.
    const [shared] = await checkShopperDesign(t.db, { product, cartId, libraryFileIds: [theirs], decorations: [deco({ fileId: theirs })] as never, lowResOk: false });
    expect(shared.artwork?.artworkFileId).toBe(theirs);
  });
});

describe("a shopper's design in the cart and on the order", () => {
  it("is priced in the cart, and the order waits for an artwork check", async () => {
    const s = await store();
    const b = t.business.id;
    const sizeId = t.product.sizes[0].id;
    const design = await t.db.design.create({
      data: {
        businessId: b,
        name: "Tee (designed online)",
        productId: t.product.id,
        colorId: t.product.colors[0].id,
        decorations: { create: { methodId: t.method.id, areaId, location: "Front / Full Front", colors: 1, widthIn: 6, heightIn: 3, artworkFileId: mine, artWidthPx: 1200, artHeightPx: 600, placeX: 0.25, placeY: 0, placeW: 0.5 } },
      },
    });
    await t.db.cartItem.create({ data: { businessId: b, cartId, designId: design.id, sizeId, qty: 12 } });
    const totals = await cartTotals(t.db, { business: t.business, store: s }, (await findCartById(t.db, cartId))!);
    const line = totals.lines.find((l) => l.designId === design.id)!;
    expect(line).toMatchObject({ available: true, qty: 12, name: "Tee", storeItemId: null });
    expect(line.unitPrice.toFixed(2)).toBe((7 + 3 + 40 / 12).toFixed(2)); // 1 color + underbase

    const order = await placeOrderFromCart(t.db, cartId, { amount: new Prisma.Decimal(totals.total.toFixed(2)), reference: "pi_design" }, "http://shop.localhost:3000");
    expect(order.approvedAt).toBeNull();
    const full = await t.db.order.findUniqueOrThrow({ where: { id: order.id }, include: { lines: { include: { sizes: true } }, files: true, events: true } });
    expect(full.lines).toHaveLength(1);
    expect(full.lines[0]).toMatchObject({ designId: design.id, fixedPrice: true });
    expect(full.lines[0].sizes[0].unitPrice.toFixed(2)).toBe(line.unitPrice.toFixed(2));
    expect(full.files.map((f) => f.fileId)).toEqual([mine]);
    expect(full.events.some((e) => e.body.includes("check the artwork"))).toBe(true);
    // No production until staff approve; the artwork joins the customer's library.
    expect(await t.db.productionJob.count({ where: { orderId: order.id } })).toBe(0);
    expect(await t.db.artworkAsset.count({ where: { fileId: mine, customerId: full.customerId } })).toBe(1);
  });
});
