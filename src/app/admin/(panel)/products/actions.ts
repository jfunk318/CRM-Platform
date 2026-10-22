"use server";

import { Prisma, type GarmentShade, type ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import type { BusinessTx } from "@/lib/db";
import {
  all,
  type ActionResult,
  checkbox,
  decimal,
  FormError,
  optionalDecimal,
  optionalInt,
  optionalText,
  runAction,
  text,
} from "@/lib/admin/form";
import { diffRows, slugify, variantSku } from "@/lib/catalog/products";

const EDITORS = ["SALES", "PURCHASING"] as const;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");
const refresh = (id: string) => {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
};

async function uniqueSlug(db: BusinessTx, base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const clash = await db.product.findFirst({ where: { slug, id: excludeId ? { not: excludeId } : undefined } });
    if (!clash) return slug;
  }
}

/** Every SKU on the product, rebuilt after a style code, color or size rename. */
async function resyncSkus(tx: BusinessTx, productId: string) {
  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    include: { variants: { include: { color: true, size: true } } },
  });
  // Two passes so swapping names between rows can't collide on the unique index.
  for (const v of product.variants) {
    await tx.productVariant.update({ where: { id: v.id }, data: { sku: `tmp-${v.id}` } });
  }
  for (const v of product.variants) {
    await tx.productVariant.update({
      where: { id: v.id },
      data: { sku: variantSku(product.styleCode, v.color.name, v.size.code) },
    });
  }
}

export async function createProduct(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  let id = "";
  const result = await runAction(async () => {
    const name = text(form, "name", "Name");
    const productTypeId = text(form, "productTypeId", "Product type");
    const product = await db.product.create({
      data: {
        businessId: db.$businessId,
        name,
        styleCode: text(form, "styleCode", "Style code").toUpperCase(),
        slug: await uniqueSlug(db, name),
        supplierId: optionalText(form, "supplierId"),
        productTypeId,
        isCustom: !optionalText(form, "supplierId"),
      },
    });
    id = product.id;
  });
  if (result.error) return result;
  redirect(`/admin/products/${id}`);
}

const STATUSES: ProductStatus[] = ["ACTIVE", "CLOSING_OUT", "DISCONTINUED"];

export async function saveProductDetails(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  return runAction(async () => {
    const id = text(form, "id");
    const status = field(form, "status") as ProductStatus;
    if (!STATUSES.includes(status)) throw new FormError("Choose a status");
    const categoryIds = form.getAll("categoryIds").map(String);
    const styleCode = text(form, "styleCode", "Style code").toUpperCase();
    const before = await db.product.findUniqueOrThrow({ where: { id }, select: { styleCode: true } });

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: text(form, "name", "Name"),
          slug: await uniqueSlug(tx, optionalText(form, "slug") ?? text(form, "name"), id),
          styleCode,
          brand: optionalText(form, "brand"),
          description: optionalText(form, "description"),
          status,
          supplierId: optionalText(form, "supplierId"),
          productTypeId: text(form, "productTypeId", "Product type"),
          quantityDiscountId: optionalText(form, "quantityDiscountId"),
          isCustom: checkbox(form, "isCustom"),
          allowBlankSale: checkbox(form, "allowBlankSale"),
          productionLeadDays: optionalInt(field(form, "productionLeadDays"), "Lead days"),
          sizeChartImageUrl: optionalText(form, "sizeChartImageUrl"),
          specSheetUrl: optionalText(form, "specSheetUrl"),
        },
      });
      await tx.productCategory.deleteMany({ where: { productId: id } });
      if (categoryIds.length) {
        await tx.productCategory.createMany({ data: categoryIds.map((categoryId) => ({ businessId: db.$businessId, productId: id, categoryId })) });
      }
      if (before.styleCode !== styleCode) await resyncSkus(tx, id);
    });
    refresh(id);
  });
}

const SHADES: GarmentShade[] = ["WHITE", "LIGHT", "DARK"];

export async function saveColors(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  return runAction(async () => {
    const productId = text(form, "productId");
    const ids = all(form, "colorId");
    const names = all(form, "name");
    const hexes = all(form, "hex");
    const shades = all(form, "shade");
    const rows = names
      .map((name, i) => ({ id: ids[i] || null, name, hex: hexes[i] ?? "", shade: shades[i] as GarmentShade, sortOrder: i }))
      .filter((r) => r.name || r.hex)
      .map((r) => {
        if (!r.name) throw new FormError("Every color needs a name");
        const hex = r.hex.replace(/^#/, "");
        if (hex && !/^[0-9a-fA-F]{6}$/.test(hex)) throw new FormError(`${r.name}: hex must look like #1F2A44`);
        if (!SHADES.includes(r.shade)) throw new FormError(`${r.name}: choose white, light or dark`);
        return { ...r, hex: hex ? `#${hex.toUpperCase()}` : null };
      });
    const lower = rows.map((r) => r.name.toLowerCase());
    if (new Set(lower).size !== lower.length) throw new FormError("Two colors have the same name");

    const existing = await db.productColor.findMany({ where: { productId }, select: { id: true } });
    const d = diffRows(existing.map((c) => c.id), rows);
    await db.$transaction(async (tx) => {
      await tx.productColor.deleteMany({ where: { id: { in: d.deleteIds } } });
      // Temporary names first, so renames that swap two colors don't collide.
      for (const r of d.update) await tx.productColor.update({ where: { id: r.id }, data: { name: `~${r.id}` } });
      for (const r of d.update) {
        await tx.productColor.update({ where: { id: r.id }, data: { name: r.name, hex: r.hex, shade: r.shade, sortOrder: r.sortOrder } });
      }
      for (const r of d.create) await tx.productColor.create({ data: { ...r, businessId: db.$businessId, productId } });
      await resyncSkus(tx, productId);
    });
    refresh(productId);
    return d.deleteIds.length ? `Saved (removed ${d.deleteIds.length} color(s) and their SKUs)` : "Saved";
  });
}

export async function saveSizes(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  return runAction(async () => {
    const productId = text(form, "productId");
    const ids = all(form, "sizeId");
    const codes = all(form, "code");
    const labels = all(form, "label");
    const rows = codes
      .map((code, i) => ({ id: ids[i] || null, code: code.toUpperCase(), label: labels[i] || code.toUpperCase(), sortOrder: i }))
      .filter((r) => r.code);
    if (new Set(rows.map((r) => r.code)).size !== rows.length) throw new FormError("Two sizes have the same code");

    const existing = await db.productSize.findMany({ where: { productId }, select: { id: true } });
    const d = diffRows(existing.map((s) => s.id), rows);
    await db.$transaction(async (tx) => {
      await tx.productSize.deleteMany({ where: { id: { in: d.deleteIds } } });
      for (const r of d.update) await tx.productSize.update({ where: { id: r.id }, data: { code: `~${r.id}` } });
      for (const r of d.update) {
        await tx.productSize.update({ where: { id: r.id }, data: { code: r.code, label: r.label, sortOrder: r.sortOrder } });
      }
      for (const r of d.create) await tx.productSize.create({ data: { ...r, businessId: db.$businessId, productId } });
      await resyncSkus(tx, productId);
    });
    refresh(productId);
    return d.deleteIds.length ? `Saved (removed ${d.deleteIds.length} size(s) and their SKUs)` : "Saved";
  });
}

/**
 * Cost grid: one input per color × size named cost_<colorId>_<sizeId>.
 * A blank cost means that combination isn't offered (its SKU is removed).
 */
export async function saveCosts(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  return runAction(async () => {
    const productId = text(form, "productId");
    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { colors: true, sizes: true, variants: true },
    });
    // New SKUs must not clash with another product's (e.g. two products
    // sharing a style code).
    const newSkus = product.colors.flatMap((c) =>
      product.sizes
        .filter((sz) => field(form, `cost_${c.id}_${sz.id}`).trim() !== "")
        .filter((sz) => !product.variants.some((v) => v.colorId === c.id && v.sizeId === sz.id))
        .map((sz) => variantSku(product.styleCode, c.name, sz.code)),
    );
    if (newSkus.length) {
      const clash = await db.productVariant.findFirst({
        where: { sku: { in: newSkus }, productId: { not: productId } },
        include: { product: { select: { name: true } } },
      });
      if (clash) {
        throw new FormError(
          `SKU ${clash.sku} is already used by "${clash.product.name}". Give this product a different style code.`,
        );
      }
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let offered = 0;
    for (const color of product.colors) {
      for (const size of product.sizes) {
        const key = `${color.id}_${size.id}`;
        const cost = optionalDecimal(field(form, `cost_${key}`), `${color.name} ${size.code} cost`);
        const stockRaw = field(form, `stock_${key}`);
        const stockOnHand = optionalInt(stockRaw, `${color.name} ${size.code} stock`);
        const supplierSku = optionalText(form, `ssku_${key}`);
        const existing = product.variants.find((v) => v.colorId === color.id && v.sizeId === size.id);
        if (cost === null) {
          if (existing) ops.push(db.productVariant.delete({ where: { id: existing.id } }));
          continue;
        }
        offered++;
        const data = { wholesaleCost: cost, stockOnHand, supplierSku };
        ops.push(
          existing
            ? db.productVariant.update({ where: { id: existing.id }, data })
            : db.productVariant.create({
                data: {
                  ...data,
                  businessId: db.$businessId,
                  productId,
                  colorId: color.id,
                  sizeId: size.id,
                  sku: variantSku(product.styleCode, color.name, size.code),
                },
              }),
        );
      }
    }
    await db.$transaction(ops);
    refresh(productId);
    return `Saved ${offered} SKU(s)`;
  });
}

export async function saveViews(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  return runAction(async () => {
    const productId = text(form, "productId");
    const ids = all(form, "viewId");
    const rows = all(form, "name")
      .map((name, i) => ({ id: ids[i] || null, name, sortOrder: i }))
      .filter((r) => r.name);
    if (new Set(rows.map((r) => r.name.toLowerCase())).size !== rows.length) {
      throw new FormError("Two views have the same name");
    }
    const existing = await db.productView.findMany({ where: { productId }, select: { id: true } });
    const d = diffRows(existing.map((v) => v.id), rows);
    await db.$transaction(async (tx) => {
      await tx.productView.deleteMany({ where: { id: { in: d.deleteIds } } });
      for (const r of d.update) await tx.productView.update({ where: { id: r.id }, data: { name: `~${r.id}` } });
      for (const r of d.update) await tx.productView.update({ where: { id: r.id }, data: { name: r.name, sortOrder: r.sortOrder } });
      for (const r of d.create) await tx.productView.create({ data: { ...r, businessId: db.$businessId, productId } });
    });
    refresh(productId);
  });
}

/** One view's print areas and its product photo per color. */
export async function saveViewDetails(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  return runAction(async () => {
    const viewId = text(form, "viewId");
    const view = await db.productView.findUniqueOrThrow({ where: { id: viewId }, include: { product: { include: { colors: true } } } });

    const [names, widths, heights, xs, ys, ws, hs] = ["name", "widthIn", "heightIn", "x", "y", "w", "h"].map((n) => all(form, n));
    const fraction = (raw: string, label: string) => {
      const n = Number(raw || "0") / 100;
      if (!Number.isFinite(n) || n < 0 || n > 1) throw new FormError(`${label} must be between 0 and 100%`);
      return n;
    };
    const areas = names
      .map((name, i) => ({ name, i }))
      .filter((r) => r.name)
      .map(({ name, i }) => ({
        businessId: db.$businessId,
        viewId,
        name,
        widthIn: decimal(widths[i] ?? "", `${name} width`),
        heightIn: decimal(heights[i] ?? "", `${name} height`),
        x: fraction(xs[i] ?? "", `${name} left`),
        y: fraction(ys[i] ?? "", `${name} top`),
        w: fraction(ws[i] ?? "", `${name} box width`),
        h: fraction(hs[i] ?? "", `${name} box height`),
      }));

    const images = view.product.colors.map((c) => ({ colorId: c.id, url: optionalText(form, `img_${c.id}`) }));
    for (const img of images) {
      if (img.url && !/^https?:\/\//.test(img.url)) throw new FormError("Image links must start with http:// or https://");
    }

    await db.$transaction([
      // Quote/order items keep their location name when a print area is replaced.
      db.designDecoration.updateMany({ where: { area: { viewId } }, data: { areaId: null } }),
      db.decorationArea.deleteMany({ where: { viewId } }),
      db.decorationArea.createMany({ data: areas }),
      db.viewImage.deleteMany({ where: { viewId } }),
      db.viewImage.createMany({
        data: images.filter((i) => i.url).map((i) => ({ businessId: db.$businessId, viewId, colorId: i.colorId, url: i.url! })),
      }),
    ]);
    refresh(view.productId);
  });
}

export async function saveMethodRules(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff([...EDITORS]);
  return runAction(async () => {
    const productId = text(form, "productId");
    const methodIds = all(form, "methodId");
    const ops = methodIds.map((methodId) => {
      const enabled = checkbox(form, `enabled_${methodId}`);
      const minQty = optionalInt(field(form, `minQty_${methodId}`), "Minimum quantity");
      // No row = use the method's defaults; only store real overrides.
      return enabled && minQty === null
        ? db.productDecorationRule.deleteMany({ where: { productId, methodId } })
        : db.productDecorationRule.upsert({
            where: { productId_methodId: { productId, methodId } },
            update: { enabled, minQty },
            create: { businessId: db.$businessId, productId, methodId, enabled, minQty },
          });
    });
    await db.$transaction(ops);
    refresh(productId);
  });
}

export async function deleteProduct(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  const result = await runAction(async () => {
    await db.product.delete({ where: { id: text(form, "id") } });
  });
  if (result.error) return result;
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
