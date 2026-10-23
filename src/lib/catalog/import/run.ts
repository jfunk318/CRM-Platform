import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { type BusinessDb, type BusinessTx, forBusiness } from "@/lib/db";
import { fileStore } from "@/lib/files/storage";
import { slugify } from "@/lib/catalog/products";
import {
  colorHex,
  colorShade,
  type FileSummary,
  ImportFileError,
  type ImportOptions,
  readSanmarFile,
  styleSelected,
  summarize,
  type SupplierRow,
} from "./sanmar";

export { ImportFileError };

export const MAX_IMPORT_MB = 50;
const SOURCE = "sanmar";

export type ImportResult = {
  productsAdded: number;
  productsUpdated: number;
  colorsAdded: number;
  sizesAdded: number;
  skusAdded: number;
  skusUpdated: number;
  rowsSkipped: number;
};

/** Read an uploaded file, keep it, and record what's in it for choosing. */
export async function createCatalogImport(db: BusinessDb, o: { supplierId: string; file: File; staffId: string | null }): Promise<string> {
  const name = o.file.name || "import";
  if (!/\.(zip|csv)$/i.test(name)) throw new ImportFileError("Upload the .zip or .csv file from SanMar");
  if (o.file.size > MAX_IMPORT_MB * 1024 * 1024) {
    throw new ImportFileError(`That file is over ${MAX_IMPORT_MB} MB. Upload the zip (SanMar_SDL_N.zip) rather than the unzipped CSV.`);
  }
  await db.supplier.findUniqueOrThrow({ where: { id: o.supplierId } });
  const bytes = Buffer.from(await o.file.arrayBuffer());
  const summary = await summarize(readSanmarFile(bytes, name));
  if (summary.styles.length === 0) throw new ImportFileError("No products found in that file");
  const month = new Date().toISOString().slice(0, 7);
  const storageKey = `${db.$businessId}/imports/${month}/${randomBytes(12).toString("hex")}.${name.toLowerCase().endsWith(".zip") ? "zip" : "csv"}`;
  await fileStore.put(storageKey, bytes);
  const row = await db.catalogImport.create({
    data: { businessId: db.$businessId, supplierId: o.supplierId, format: "SANMAR_SDL", fileName: name.slice(0, 200), storageKey, summary, createdById: o.staffId },
  });
  return row.id;
}

/** The styles the options pick out of a file's summary. */
export const selectedStyles = (summary: FileSummary, o: ImportOptions) =>
  summary.styles.filter(([, brand, categories, discontinued]) => styleSelected({ brand, categories, discontinued }, o));

/**
 * Start (or run again with other choices) an import in the background.
 * Returns straight away; the import page shows progress.
 */
export async function startCatalogImport(db: BusinessDb, importId: string, options: ImportOptions): Promise<number> {
  const imp = await db.catalogImport.findUniqueOrThrow({ where: { id: importId } });
  const total = selectedStyles(imp.summary as FileSummary, options).length;
  if (total === 0) throw new ImportFileError("Nothing matches those choices");
  const running = await db.catalogImport.findFirst({ where: { status: "RUNNING", updatedAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (running) throw new ImportFileError("Another import is running; wait for it to finish");
  const claimed = await db.catalogImport.updateMany({
    where: { id: importId, status: { in: ["READY", "DONE", "FAILED", "RUNNING"] } },
    data: { status: "RUNNING", options, total, progress: 0, result: Prisma.DbNull, error: null, finishedAt: null },
  });
  if (claimed.count === 0) throw new ImportFileError("That import can't be started");
  const businessId = db.$businessId;
  void runCatalogImport(businessId, importId).catch(async (e) => {
    await forBusiness(businessId).catalogImport.update({
      where: { id: importId },
      data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 1000) : String(e), finishedAt: new Date() },
    });
  });
  return total;
}

type Defaults = { areas: { view: string; name: string; w: number; h: number; box: [number, number, number, number] }[] };

/** Print areas new products start with, by kind of product. */
function defaultAreas(categories: string[]): Defaults["areas"] {
  const has = (re: RegExp) => categories.some((c) => re.test(c));
  if (has(/cap|headwear|beanie|hat/i)) {
    return [
      { view: "Front", name: "Front Panel", w: 4.5, h: 2.25, box: [0.3, 0.3, 0.4, 0.2] },
      { view: "Back", name: "Back Arch", w: 3, h: 1, box: [0.35, 0.45, 0.3, 0.1] },
    ];
  }
  if (has(/bag/i)) return [{ view: "Front", name: "Front", w: 10, h: 10, box: [0.25, 0.3, 0.5, 0.4] }];
  return [
    { view: "Front", name: "Full Front", w: 12, h: 14, box: [0.3, 0.22, 0.4, 0.45] },
    { view: "Front", name: "Left Chest", w: 4, h: 4, box: [0.56, 0.24, 0.12, 0.12] },
    { view: "Back", name: "Full Back", w: 12, h: 14, box: [0.3, 0.2, 0.4, 0.45] },
  ];
}

/** Load the selected rows, grouped by style, from the stored file. */
async function rowsByStyle(storageKey: string, fileName: string, options: ImportOptions, summary: FileSummary) {
  const wanted = new Set(selectedStyles(summary, options).map(([style]) => style));
  const byStyle = new Map<string, SupplierRow[]>();
  for await (const r of readSanmarFile(await fileStore.get(storageKey), fileName)) {
    if (!wanted.has(r.style)) continue;
    const list = byStyle.get(r.style);
    // The description repeats on every row; keep it once per style.
    if (list) list.push({ ...r, description: "" });
    else byStyle.set(r.style, [r]);
  }
  return byStyle;
}

export async function runCatalogImport(businessId: string, importId: string) {
  const db = forBusiness(businessId);
  const imp = await db.catalogImport.findUniqueOrThrow({ where: { id: importId } });
  const options = imp.options as ImportOptions;
  const byStyle = await rowsByStyle(imp.storageKey, imp.fileName, options, imp.summary as FileSummary);

  const productType = (await db.productType.findFirst({ where: { name: "Apparel" } })) ?? (await db.productType.findFirstOrThrow());
  const categories = new Map((await db.category.findMany()).map((c) => [c.name.toLowerCase(), c.id]));
  const categorySlugs = new Set((await db.category.findMany({ select: { slug: true } })).map((c) => c.slug));
  const productSlugs = new Set((await db.product.findMany({ select: { slug: true } })).map((p) => p.slug));
  const linked = new Map((await db.product.findMany({ where: { externalSource: SOURCE }, select: { id: true, externalId: true } })).map((p) => [p.externalId!, p.id]));
  // Products entered by hand with the same style code are adopted, not duplicated.
  const manual = new Map((await db.product.findMany({ where: { externalSource: null }, select: { id: true, styleCode: true } })).map((p) => [p.styleCode.toUpperCase(), p.id]));

  const result: ImportResult = { productsAdded: 0, productsUpdated: 0, colorsAdded: 0, sizesAdded: 0, skusAdded: 0, skusUpdated: 0, rowsSkipped: 0 };
  const skuCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const unique = (base: string, taken: Set<string>) => {
    let s = base;
    for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
    taken.add(s);
    return s;
  };
  const categoryId = async (tx: BusinessTx, name: string) => {
    const key = name.toLowerCase();
    if (categories.has(key)) return categories.get(key)!;
    const c = await tx.category.create({ data: { businessId, name, slug: unique(slugify(name) || "category", categorySlugs), sortOrder: categories.size } });
    categories.set(key, c.id);
    return c.id;
  };

  let done = 0;
  for (const [style, rows] of byStyle) {
    await db.$transaction(
      async (tx) => {
        const first = rows[0];
        const discontinued = rows.every((r) => r.discontinued);
        const existingId = linked.get(style) ?? manual.get(style.toUpperCase());
        let productId: string;
        if (existingId) {
          // Keep what staff may have edited (name, description, categories);
          // refresh what the supplier owns.
          const p = await tx.product.update({
            where: { id: existingId },
            data: { externalSource: SOURCE, externalId: style, status: discontinued ? "DISCONTINUED" : undefined, brand: first.brand || undefined },
          });
          if (!p.supplierId) await tx.product.update({ where: { id: p.id }, data: { supplierId: imp.supplierId } });
          if (!p.specSheetUrl && first.specSheetUrl) await tx.product.update({ where: { id: p.id }, data: { specSheetUrl: first.specSheetUrl } });
          productId = p.id;
          manual.delete(style.toUpperCase());
          result.productsUpdated++;
        } else {
          const p = await tx.product.create({
            data: {
              businessId,
              slug: unique(slugify(`${first.brand} ${style}`) || slugify(style), productSlugs),
              styleCode: style,
              name: first.name,
              brand: first.brand || null,
              description: first.description || null,
              status: discontinued ? "DISCONTINUED" : "ACTIVE",
              specSheetUrl: first.specSheetUrl,
              supplierId: imp.supplierId,
              productTypeId: productType.id,
              externalSource: SOURCE,
              externalId: style,
            },
          });
          productId = p.id;
          const catNames = [...new Set(rows.flatMap((r) => r.categories))];
          for (const [i, name] of catNames.entries()) {
            await tx.productCategory.create({ data: { businessId, productId, categoryId: await categoryId(tx, name), sortOrder: i } });
          }
          result.productsAdded++;
        }
        linked.set(style, productId);

        // Colors and sizes, in the supplier's order.
        const product = await tx.product.findUniqueOrThrow({
          where: { id: productId },
          include: { colors: true, sizes: true, views: { include: { images: true, areas: true } }, variants: true, categories: { include: { category: true } } },
        });
        const colorIds = new Map(product.colors.map((c) => [c.name.toLowerCase(), c.id]));
        for (const name of [...new Set(rows.map((r) => r.color))]) {
          if (colorIds.has(name.toLowerCase())) continue;
          const c = await tx.productColor.create({ data: { businessId, productId, name, hex: colorHex(name), shade: colorShade(name), sortOrder: colorIds.size } });
          colorIds.set(name.toLowerCase(), c.id);
          result.colorsAdded++;
        }
        const sizeIds = new Map(product.sizes.map((s) => [s.code.toUpperCase(), s.id]));
        const sizeOrder = new Map<string, number>();
        for (const r of rows) sizeOrder.set(r.size, Math.min(sizeOrder.get(r.size) ?? Infinity, r.sizeOrder));
        for (const [code, order] of [...sizeOrder].sort((a, b) => a[1] - b[1])) {
          if (sizeIds.has(code.toUpperCase())) continue;
          const s = await tx.productSize.create({ data: { businessId, productId, code, label: code, sortOrder: Number.isFinite(order) ? order : sizeIds.size } });
          sizeIds.set(code.toUpperCase(), s.id);
          result.sizesAdded++;
        }

        // Front and back views with standard print areas, and each color's photos.
        const views = new Map(product.views.map((v) => [v.name, v]));
        if (product.views.length === 0) {
          const cats = product.categories.length ? product.categories.map((c) => c.category.name) : first.categories;
          const areas = defaultAreas(cats);
          for (const [i, name] of ["Front", "Back"].entries()) {
            const v = await tx.productView.create({
              data: {
                businessId,
                productId,
                name,
                sortOrder: i,
                areas: { create: areas.filter((a) => a.view === name).map((a) => ({ name: a.name, widthIn: a.w, heightIn: a.h, x: a.box[0], y: a.box[1], w: a.box[2], h: a.box[3] })) },
              },
              include: { images: true, areas: true },
            });
            views.set(name, v);
          }
        }
        const photos = new Map<string, { front: string | null; back: string | null }>();
        for (const r of rows) {
          const p = photos.get(r.color) ?? { front: null, back: null };
          photos.set(r.color, { front: p.front ?? r.frontImage, back: p.back ?? r.backImage });
        }
        for (const [color, p] of photos) {
          const colorId = colorIds.get(color.toLowerCase())!;
          for (const [viewName, url] of [["Front", p.front], ["Back", p.back]] as const) {
            const view = views.get(viewName);
            if (!view || !url) continue;
            const img = view.images.find((i) => i.colorId === colorId);
            if (!img) await tx.viewImage.create({ data: { businessId, viewId: view.id, colorId, url } });
            else if (img.url !== url) await tx.viewImage.update({ where: { id: img.id }, data: { url } });
          }
        }

        // SKUs with this import's cost.
        const byExternal = new Map(product.variants.filter((v) => v.externalId).map((v) => [v.externalId!, v]));
        const byCombo = new Map(product.variants.map((v) => [`${v.colorId}:${v.sizeId}`, v]));
        const create: Prisma.ProductVariantCreateManyInput[] = [];
        // SKU codes in use that new ones for this style could collide with.
        const skus = new Set((await tx.productVariant.findMany({ where: { sku: { startsWith: skuCode(style) } }, select: { sku: true } })).map((v) => v.sku));
        const adding = new Set<string>();
        for (const r of rows) {
          const cost = r.cost[options.cost] ?? r.cost.piece ?? r.cost.case;
          if (cost === null) {
            result.rowsSkipped++;
            continue;
          }
          const colorId = colorIds.get(r.color.toLowerCase())!;
          const sizeId = sizeIds.get(r.size.toUpperCase())!;
          const supplierSku = `${r.style} ${r.supplierColor} ${r.size}`;
          const combo = `${colorId}:${sizeId}`;
          if (adding.has(combo)) continue;
          const existing = byExternal.get(r.externalId) ?? byCombo.get(combo);
          if (existing) {
            if (!existing.wholesaleCost.equals(cost) || existing.supplierSku !== supplierSku || existing.active === r.discontinued || existing.externalId !== r.externalId) {
              await tx.productVariant.update({
                where: { id: existing.id },
                data: { wholesaleCost: cost, supplierSku, active: !r.discontinued, externalSource: SOURCE, externalId: r.externalId },
              });
              result.skusUpdated++;
            }
            continue;
          }
          create.push({
            businessId,
            productId,
            colorId,
            sizeId,
            sku: unique(skuCode(`${r.style}-${r.color}-${r.size}`), skus),
            supplierSku,
            wholesaleCost: cost,
            active: !r.discontinued,
            externalSource: SOURCE,
            externalId: r.externalId,
          });
          adding.add(combo);
        }
        if (create.length) await tx.productVariant.createMany({ data: create });
        result.skusAdded += create.length;
      },
      { timeout: 120_000 },
    );
    done++;
    if (done % 10 === 0 || done === byStyle.size) await db.catalogImport.update({ where: { id: importId }, data: { progress: done } });
  }
  await db.catalogImport.update({ where: { id: importId }, data: { status: "DONE", progress: done, total: byStyle.size, result, finishedAt: new Date() } });
  return result;
}
