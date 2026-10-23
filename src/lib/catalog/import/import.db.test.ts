// Importing a SanMar-format file into a throwaway business.
import { zipSync, strToU8 } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { createCatalogImport, runCatalogImport, startCatalogImport } from "./run";
import { sampleCsv, tee } from "./sample";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let supplierId = "";

beforeAll(async () => {
  t = await makeTestBusiness(`imp-${Date.now()}`);
  supplierId = (await t.db.supplier.create({ data: { businessId: t.business.id, code: "sanmar", name: "SanMar" } })).id;
  // A product entered by hand with a SanMar style code: adopted, not duplicated.
  await t.db.product.update({ where: { id: t.product.id }, data: { styleCode: "PC61" } });
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const upload = (rows: ReturnType<typeof tee>) =>
  new File([new Uint8Array(zipSync({ "SanMar_SDL_N.csv": strToU8(sampleCsv(rows)) }))], "SanMar_SDL_N.zip", { type: "application/zip" });

async function importAll(id: string, cost: "piece" | "case" = "piece", brands: string[] | null = null) {
  await t.db.catalogImport.update({ where: { id }, data: { options: { brands, categories: null, includeDiscontinued: false, cost }, status: "RUNNING" } });
  return runCatalogImport(t.business.id, id);
}

describe("catalog import", () => {
  let first = "";

  it("reads the upload and records a summary to choose from", async () => {
    first = await createCatalogImport(t.db, { supplierId, file: upload([...tee("PC54"), ...tee("PC61"), ...tee("BG100", { brand: "District", category: "Bags" }), ...tee("OLD1", { status: "Discontinued" })]), staffId: t.staff.id });
    const imp = await t.db.catalogImport.findUniqueOrThrow({ where: { id: first } });
    expect(imp.status).toBe("READY");
    expect((imp.summary as { styles: unknown[] }).styles).toHaveLength(4);
  });

  it("imports the chosen brands with colors, sizes, costs, photos and print areas", async () => {
    const r = await importAll(first, "piece", ["Port & Co"]);
    // PC54 is new; PC61 was entered by hand and is adopted; OLD1 is discontinued and skipped; District isn't chosen.
    expect(r).toMatchObject({ productsAdded: 1, productsUpdated: 1, skusAdded: 8 });
    const p = await t.db.product.findFirstOrThrow({
      where: { styleCode: "PC54" },
      include: { colors: { orderBy: { sortOrder: "asc" } }, sizes: { orderBy: { sortOrder: "asc" } }, variants: true, views: { include: { areas: true, images: true }, orderBy: { sortOrder: "asc" } }, categories: { include: { category: true } } },
    });
    expect(p).toMatchObject({ name: "Core Cotton Tee", brand: "Port & Co", supplierId, externalSource: "sanmar", status: "ACTIVE" });
    expect(p.colors.map((c) => [c.name, c.shade])).toEqual([["Jet Black", "DARK"], ["White", "WHITE"]]);
    expect(p.sizes.map((s) => s.code)).toEqual(["S", "M"]);
    expect(p.variants.map((v) => v.wholesaleCost.toFixed(2))).toEqual(["3.50", "3.50", "3.50", "3.50"]);
    expect(p.variants.find((v) => v.sku === "PC54-JET-BLACK-S")?.supplierSku).toBe("PC54 JET BLACK S");
    expect(p.views.map((v) => [v.name, v.areas.map((a) => a.name), v.images.length])).toEqual([["Front", ["Full Front", "Left Chest"], 2], ["Back", ["Full Back"], 2]]);
    expect(p.categories.map((c) => c.category.name).sort()).toEqual(["T-Shirts", "Youth"]);
    const adopted = await t.db.product.findUniqueOrThrow({ where: { id: t.product.id }, include: { variants: true } });
    expect(adopted).toMatchObject({ externalSource: "sanmar", externalId: "PC61", name: "Tee", supplierId });
    expect(adopted.variants.length).toBe(1 + 4);
    const done = await t.db.catalogImport.findUniqueOrThrow({ where: { id: first } });
    expect(done).toMatchObject({ status: "DONE", progress: 2, total: 2 });
  });

  it("updates costs and adds new colors from a newer file, keeping your edits", async () => {
    await t.db.product.updateMany({ where: { styleCode: "PC54" }, data: { name: "Our Classic Tee", description: "Edited" } });
    const second = await createCatalogImport(t.db, { supplierId, file: upload(tee("PC54", { piece: "3.75", colors: ["Jet Black", "White", "Navy"] })), staffId: null });
    const r = await importAll(second, "case");
    expect(r).toMatchObject({ productsAdded: 0, productsUpdated: 1, colorsAdded: 1, skusAdded: 2, skusUpdated: 4 });
    const p = await t.db.product.findFirstOrThrow({ where: { styleCode: "PC54" }, include: { variants: true, colors: true } });
    expect(p.name).toBe("Our Classic Tee");
    expect(p.description).toBe("Edited");
    expect(new Set(p.variants.map((v) => v.wholesaleCost.toFixed(2)))).toEqual(new Set(["2.50"]));
    expect(await t.db.product.count({ where: { styleCode: "PC54" } })).toBe(1);
  });

  it("starts in the background and won't start with nothing chosen", async () => {
    await expect(startCatalogImport(t.db, first, { brands: ["Nobody"], categories: null, includeDiscontinued: false, cost: "piece" })).rejects.toThrow(/Nothing matches/);
    expect(await startCatalogImport(t.db, first, { brands: ["District"], categories: null, includeDiscontinued: false, cost: "piece" })).toBe(1);
    for (let i = 0; i < 50 && (await t.db.catalogImport.findUniqueOrThrow({ where: { id: first } })).status === "RUNNING"; i++) await new Promise((r) => setTimeout(r, 100));
    expect((await t.db.catalogImport.findUniqueOrThrow({ where: { id: first } })).status).toBe("DONE");
    const bag = await t.db.product.findFirstOrThrow({ where: { styleCode: "BG100" }, include: { views: { include: { areas: true } } } });
    expect(bag.views.flatMap((v) => v.areas.map((a) => a.name))).toEqual(["Front"]);
  });
});
