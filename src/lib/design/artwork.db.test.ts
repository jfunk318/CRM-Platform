// Placed artwork on quote/order items: saving, mockups and proof images.
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { parseArtwork } from "@/lib/admin/line-form";
import { removeOrderFile } from "@/lib/files/order-files";
import { saveUpload } from "@/lib/files/storage";
import { createProof } from "@/lib/orders/customer-flow";
import { addLine, createOrder, OrderError, updateLine, type ArtworkSpec } from "@/lib/orders/service";
import { makeTestBusiness } from "@/test/fixtures";
import { designMockups, renderMockup } from "./mockups";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let other: Awaited<ReturnType<typeof makeTestBusiness>>;
let areaId = "";
let art: ArtworkSpec;

/** A solid red 200 × 100 PNG. */
const redPng = async () => new File([new Uint8Array(await sharp({ create: { width: 200, height: 100, channels: 4, background: "#ff0000" } }).png().toBuffer())], "logo.png", { type: "image/png" });

beforeAll(async () => {
  t = await makeTestBusiness(`art-${Date.now()}`);
  other = await makeTestBusiness(`art-other-${Date.now()}`);
  const view = await t.db.productView.create({ data: { businessId: t.business.id, productId: t.product.id, name: "Front" } });
  // A 10 × 10 in area filling the middle half of the photo.
  areaId = (await t.db.decorationArea.create({ data: { businessId: t.business.id, viewId: view.id, name: "Full Front", widthIn: 10, heightIn: 10, x: 0.25, y: 0.25, w: 0.5, h: 0.5 } })).id;
  await t.db.viewImage.create({ data: { businessId: t.business.id, viewId: view.id, colorId: t.product.colors[0].id, url: "https://photos.example/navy-front.jpg" } });
  const source = await saveUpload(t.db, await redPng(), t.staff.id);
  const edited = await saveUpload(t.db, await redPng(), t.staff.id);
  art = { artworkFileId: edited.id, sourceFileId: source.id, edits: { trim: true }, widthPx: 200, heightPx: 100, x: 0.25, y: 0, w: 0.5, rotation: 0 };
});
afterAll(async () => {
  await t.cleanup();
  await other.cleanup();
  await prisma.$disconnect();
});

const withArt = (a: ArtworkSpec | null = art) => {
  const line = t.line(12);
  return { ...line, decorations: [{ ...line.decorations[0], areaId, location: "Front / Full Front", artwork: a }] };
};

describe("placed artwork", () => {
  let orderId = "";
  let lineId = "";

  it("is saved on the decoration and its original listed in the order's files", async () => {
    orderId = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
    lineId = await addLine(t.db, orderId, withArt(), t.staff.id);
    const line = await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId }, include: { design: { include: { decorations: true } } } });
    expect(line.design.decorations[0]).toMatchObject({ artworkFileId: art.artworkFileId, sourceFileId: art.sourceFileId, artWidthPx: 200, placeX: 0.25, placeW: 0.5, artEdits: { trim: true } });
    const files = await t.db.orderFile.findMany({ where: { orderId } });
    expect(files.map((f) => [f.fileId, f.kind])).toEqual([[art.sourceFileId, "ARTWORK"]]);
    // Saving again doesn't list it twice.
    await updateLine(t.db, lineId, withArt({ ...art, x: 0 }), t.staff.id);
    expect(await t.db.orderFile.count({ where: { orderId } })).toBe(1);
  });

  it("refuses another business's files", async () => {
    const foreign = await saveUpload(other.db, await redPng(), other.staff.id);
    await expect(addLine(t.db, orderId, withArt({ ...art, artworkFileId: foreign.id }), t.staff.id)).rejects.toThrow(OrderError);
  });

  it("builds mockups: the view's photo in the item's color with the artwork placed", async () => {
    const line = await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId } });
    const m = (await designMockups(t.db, [line.designId])).get(line.designId)!;
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ viewName: "Front", photoUrl: "https://photos.example/navy-front.jpg" });
    // x 0 and half the area's width → starts at the area's left edge, a quarter of the photo wide; half as tall as wide.
    expect(m[0].layers[0]).toMatchObject({ fileId: art.artworkFileId, left: 0.25, top: 0.25, width: 0.25, height: 0.125 });
  });

  it("renders a mockup image with the artwork where it was placed", async () => {
    const line = await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId } });
    const [m] = (await designMockups(t.db, [line.designId])).get(line.designId)!;
    // The example photo can't be fetched, so the art goes on a plain background.
    const png = await renderMockup(t.db, m);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const px = (fx: number, fy: number) => {
      const i = (Math.round(fy * info.height) * info.width + Math.round(fx * info.width)) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    };
    expect([info.width, info.height]).toEqual([1200, 1200]);
    expect(px(0.375, 0.3)).toEqual([255, 0, 0]); // inside the art
    expect(px(0.6, 0.3)).not.toEqual([255, 0, 0]); // beside it
  });

  it("makes proof images from the mockups", async () => {
    const proof = await createProof(t.db, orderId, { orderFileIds: [], uploads: [], message: null, staffId: t.staff.id, mockups: true });
    const files = await t.db.proofFile.findMany({ where: { proofId: proof.id }, include: { file: true } });
    expect(files.map((f) => f.file.name)).toEqual(["Tee Navy Front mockup.png"]);
    expect(await t.db.orderFile.count({ where: { orderId, kind: "MOCKUP" } })).toBe(1);
  });

  it("keeps artwork files that items still use when removed from the order's files", async () => {
    const link = await t.db.orderFile.findFirstOrThrow({ where: { orderId, fileId: art.sourceFileId! } });
    await removeOrderFile(t.db, link.id, t.staff.id);
    expect(await t.db.storedFile.count({ where: { id: art.sourceFileId! } })).toBe(1);
  });
});

describe("artwork from the item form", () => {
  const ok = { artworkFileId: "cmabcdefghijklmnop", sourceFileId: null, widthPx: 100, heightPx: 50, x: 0.1, y: 0, w: 0.5, rotation: -10, edits: { trim: true } };
  it("reads the studio's JSON", () => {
    expect(parseArtwork("", 0)).toBeNull();
    expect(parseArtwork(JSON.stringify(ok), 0)).toMatchObject({ artworkFileId: ok.artworkFileId, rotation: 350, edits: { trim: true } });
  });
  it("rejects damaged or out-of-range values", () => {
    for (const bad of ["{", JSON.stringify({ ...ok, w: 2 }), JSON.stringify({ ...ok, artworkFileId: "../x" }), JSON.stringify({ ...ok, widthPx: 0 }), JSON.stringify({ ...ok, edits: [] })]) {
      expect(() => parseArtwork(bad, 1)).toThrow(/Decoration 2/);
    }
  });
});
