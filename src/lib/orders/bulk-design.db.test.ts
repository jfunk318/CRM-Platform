// Bulk design: lines sent as JSON by the bulk tools, live prices that follow
// the artwork's size, stitches and colors, and items staying independent.
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseLineJson } from "@/lib/admin/line-form";
import { FormError } from "@/lib/admin/form";
import { prisma } from "@/lib/db";
import { saveUpload } from "@/lib/files/storage";
import { makeTestBusiness } from "@/test/fixtures";
import { previewPrices } from "./pricing";
import { addLine, createOrder, updateLine } from "./service";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let orderId = "";
let fileId = "";
let dtf = "";
let emb = "";

beforeAll(async () => {
  t = await makeTestBusiness(`bulk-${Date.now()}`);
  const businessId = t.business.id;
  const method = (code: string, kind: "DTF" | "EMBROIDERY", pricingModel: "AREA" | "PER_STITCH", cells: [number, number, number][]) =>
    t.db.decorationMethod.create({
      data: { businessId, code, name: code, shortName: code, kind, pricingModel, minQty: 1, priceTables: { create: { name: code, cells: { create: cells.map(([minQty, dimensionMax, unitPrice]) => ({ minQty, dimensionMax, unitPrice })) } } } },
    });
  dtf = (await method("DTF", "DTF", "AREA", [[1, 20, 4], [1, 80, 7], [1, 200, 10]])).id;
  emb = (await method("EMB", "EMBROIDERY", "PER_STITCH", [[1, 5000, 5], [1, 10000, 8], [1, 30000, 12]])).id;
  const type = await t.db.product.findUniqueOrThrow({ where: { id: t.product.id } });
  await t.db.productTypeDecoration.createMany({ data: [dtf, emb].map((methodId) => ({ businessId, productTypeId: type.productTypeId, methodId })) });
  orderId = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
  const png = await sharp({ create: { width: 400, height: 200, channels: 4, background: "#ff0000" } }).png().toBuffer();
  fileId = (await saveUpload(t.db, new File([new Uint8Array(png)], "logo.png", { type: "image/png" }), t.staff.id)).id;
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const size = () => t.product.sizes[0].id;
const json = (o: { methodId: string; w: string; h: string; stitches?: string; x?: number }) => ({
  productId: t.product.id,
  colorId: t.product.colors[0].id,
  quantities: { [size()]: "12" },
  notes: "",
  decorations: [
    {
      methodId: o.methodId,
      areaId: "",
      location: "Front / Full Front",
      colors: "",
      stitches: o.stitches ?? "",
      widthIn: o.w,
      heightIn: o.h,
      inkColors: "",
      needsArtwork: false,
      needsDigitizing: false,
      reuseScreens: false,
      stitchesSet: false,
      artwork: { artworkFileId: fileId, sourceFileId: null, edits: {}, widthPx: 400, heightPx: 200, x: o.x ?? 0.1, y: 0, w: 0.8, rotation: 0, coverage: 0.42 },
      artworkUrl: `/admin/files/${fileId}`,
    },
  ],
});

describe("lines from the bulk tools", () => {
  it("are checked like the item form, and keep the artwork's coverage", async () => {
    const spec = parseLineJson(json({ methodId: emb, w: "4", h: "2", stitches: "6000" }));
    expect(spec.decorations[0]).toMatchObject({ methodId: emb, widthIn: 4, stitches: 6000, artwork: { coverage: 0.42 } });
    expect(() => parseLineJson({ ...json({ methodId: emb, w: "x", h: "2" }) }, "Item 3")).toThrow(/Item 3: Width/);
    expect(() => parseLineJson({ productId: "p" }, "Item 1")).toThrow(FormError);
  });

  it("each item is its own: changing one leaves the others alone", async () => {
    const a = await addLine(t.db, orderId, parseLineJson(json({ methodId: dtf, w: "8", h: "4" })), t.staff.id);
    const b = await addLine(t.db, orderId, parseLineJson(json({ methodId: dtf, w: "8", h: "4" })), t.staff.id);
    await updateLine(t.db, b, parseLineJson(json({ methodId: dtf, w: "3", h: "1.5", x: 0.3 })), t.staff.id);
    const [la, lb] = await Promise.all([a, b].map((id) => t.db.orderLine.findUniqueOrThrow({ where: { id }, include: { design: { include: { decorations: true } } } })));
    expect(la.designId).not.toBe(lb.designId);
    expect(la.design.decorations[0]).toMatchObject({ placeX: 0.1, artCoverage: 0.42 });
    expect(la.design.decorations[0].widthIn?.toNumber()).toBe(8);
    expect(lb.design.decorations[0]).toMatchObject({ placeX: 0.3 });
    expect(lb.design.decorations[0].widthIn?.toNumber()).toBe(3);
    // DTF by area: 32 sq in → $7 a piece; 4.5 sq in → $4.
    expect(la.decorationUnit.toNumber()).toBe(7);
    expect(lb.decorationUnit.toNumber()).toBe(4);
  });
});

describe("live prices", () => {
  const line = (key: string, methodId: string, d: { widthIn?: number; heightIn?: number; stitches?: number; colors?: number }, quantities: Record<string, number> = { [size()]: 12 }) => ({
    key,
    productId: t.product.id,
    colorId: t.product.colors[0].id,
    quantities,
    decorations: [{ methodId, location: "Front / Full Front", ...d }],
  });

  it("follow the artwork: DTF by size, embroidery by stitches, screen print by colors and locations", async () => {
    const [small, big, few, many, one, two] = await previewPrices(t.db, {
      lines: [
        line("small", dtf, { widthIn: 4, heightIn: 2 }),
        line("big", dtf, { widthIn: 12, heightIn: 10 }),
        line("few", emb, { stitches: 4000 }),
        line("many", emb, { stitches: 20000 }),
        line("one", t.method.id, { colors: 1 }),
        { ...line("two", t.method.id, { colors: 1 }), decorations: [{ methodId: t.method.id, location: "Front", colors: 1 }, { methodId: t.method.id, location: "Back", colors: 1 }] },
      ],
    });
    expect([small.decorationUnit, big.decorationUnit]).toEqual(["4.00", "10.00"]);
    expect([few.decorationUnit, many.decorationUnit]).toEqual(["5.00", "12.00"]);
    // A second screen-printed location doubles the print price and adds its own screen.
    expect(Number(two.decorationUnit)).toBe(2 * Number(one.decorationUnit));
    expect(two.fees.filter((f) => f.description.includes("screen"))).toHaveLength(2);
    expect(Number(two.total)).toBeGreaterThan(Number(one.total));
    expect(small).toMatchObject({ qty: 12, assumedQty: false });
  });

  it("price a typical run when no quantities are entered, and report problems instead of failing", async () => {
    const [p, bad] = await previewPrices(t.db, { orderId, lines: [line("p", dtf, { widthIn: 4, heightIn: 2 }, {}), line("bad", dtf, { widthIn: 30, heightIn: 20 })] });
    expect(p).toMatchObject({ qty: 12, assumedQty: true });
    expect(bad.issues[0].code).toBe("DIMENSION_TOO_LARGE");
  });
});
