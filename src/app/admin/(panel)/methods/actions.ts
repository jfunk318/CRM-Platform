"use server";

import type { DecorationKind, DecorationPricingModel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import {
  type ActionResult,
  checkbox,
  decimal,
  FormError,
  int,
  optionalInt,
  optionalText,
  runAction,
  text,
} from "@/lib/admin/form";
import { parsePriceGrid } from "@/lib/admin/validate";
import { CAPABILITIES, KIND_LABELS, PRICING_MODEL_LABELS } from "@/lib/catalog/methods";

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

function kind(form: FormData): DecorationKind {
  const v = field(form, "kind");
  if (!(v in KIND_LABELS)) throw new FormError("Choose a method type");
  return v as DecorationKind;
}

function pricingModel(form: FormData): DecorationPricingModel {
  const v = field(form, "pricingModel");
  if (!(v in PRICING_MODEL_LABELS)) throw new FormError("Choose how the method is priced");
  return v as DecorationPricingModel;
}

const defaultModel: Record<DecorationKind, DecorationPricingModel> = {
  SCREEN_PRINT: "PER_COLOR",
  EMBROIDERY: "PER_STITCH",
  DTF: "AREA",
  DIGITAL: "AREA",
  VINYL: "AREA",
  TRANSFER: "AREA",
  ENGRAVING: "FLAT",
  OTHER: "FLAT",
};

export async function createMethod(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  let id = "";
  const result = await runAction(async () => {
    const k = kind(form);
    const name = text(form, "name", "Name");
    const method = await db.decorationMethod.create({
      data: {
        businessId: db.$businessId,
        name,
        shortName: name,
        code: text(form, "code", "Code").toUpperCase(),
        kind: k,
        pricingModel: defaultModel[k],
        active: false, // stays hidden from customers until it has prices
        sortOrder: await db.decorationMethod.count(),
      },
    });
    const apparel = await db.productType.findFirst({ where: { name: "Apparel" } });
    if (apparel) {
      await db.productTypeDecoration.create({ data: { businessId: db.$businessId, productTypeId: apparel.id, methodId: method.id } });
    }
    id = method.id;
  });
  if (result.error) return result;
  redirect(`/admin/methods/${id}`);
}

export async function saveMethod(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const id = text(form, "id");
    const current = await db.decorationMethod.findUniqueOrThrow({ where: { id } });
    const model = pricingModel(form);
    const capabilities = Object.fromEntries(Object.keys(CAPABILITIES).map((k) => [k, checkbox(form, `cap_${k}`)]));

    await db.$transaction(async (tx) => {
      await tx.decorationMethod.update({
        where: { id },
        data: {
          name: text(form, "name", "Name"),
          shortName: text(form, "shortName", "Short name"),
          code: text(form, "code", "Code").toUpperCase(),
          description: optionalText(form, "description"),
          kind: kind(form),
          pricingModel: model,
          active: checkbox(form, "active"),
          sortOrder: int(field(form, "sortOrder") || "0", "Sort order"),
          minQty: Math.max(1, int(field(form, "minQty") || "1", "Minimum quantity")),
          maxColors: optionalInt(field(form, "maxColors"), "Max colors"),
          minDpi: optionalInt(field(form, "minDpi"), "Minimum DPI"),
          perfectDpi: optionalInt(field(form, "perfectDpi"), "Ideal DPI"),
          productionLeadDays: int(field(form, "productionLeadDays") || "0", "Lead days"),
          ...(field(form, "stitchDensity") ? { stitchDensity: Math.min(10000, Math.max(100, int(field(form, "stitchDensity"), "Stitches per square inch"))) } : {}),
          screenSetupFee: decimal(field(form, "screenSetupFee") || "0", "Screen setup fee"),
          chargeWhiteBaseScreen: checkbox(form, "chargeWhiteBaseScreen"),
          useWhiteBaseOnDark: checkbox(form, "useWhiteBaseOnDark"),
          artworkFee: decimal(field(form, "artworkFee") || "0", "Artwork fee"),
          digitizingFee: decimal(field(form, "digitizingFee") || "0", "Digitizing fee"),
          digitizingFeePerInch: checkbox(form, "digitizingFeePerInch"),
          proofingFee: decimal(field(form, "proofingFee") || "0", "Proof fee"),
          combineSameDesignQty: checkbox(form, "combineSameDesignQty"),
          capabilities,
        },
      });
      // A different pricing model means the existing grids' columns no longer
      // mean the same thing (colors vs stitches vs sq in).
      if (model !== current.pricingModel) {
        await tx.decorationPriceTable.updateMany({ where: { methodId: id }, data: { isPlaceholder: true } });
      }
    });
    revalidatePath("/admin/methods");
    revalidatePath(`/admin/methods/${id}`);
    return model !== current.pricingModel
      ? "Saved. Pricing type changed, so re-check this method's price tables"
      : "Saved";
  });
}

export async function savePriceTable(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  return runAction(async () => {
    const methodId = text(form, "methodId");
    const pricingGroupId = optionalText(form, "pricingGroupId");
    const method = await db.decorationMethod.findUniqueOrThrow({ where: { id: methodId } });
    const cells = parsePriceGrid(field(form, "grid"), method.pricingModel === "FLAT");

    await db.$transaction(async (tx) => {
      const existing = await tx.decorationPriceTable.findFirst({ where: { methodId, pricingGroupId } });
      const table =
        existing ??
        (await tx.decorationPriceTable.create({
          data: { businessId: db.$businessId, methodId, pricingGroupId, name: `${method.shortName} prices` },
        }));
      await tx.decorationPriceCell.deleteMany({ where: { tableId: table.id } });
      await tx.decorationPriceCell.createMany({ data: cells.map((c) => ({ ...c, businessId: db.$businessId, tableId: table.id })) });
      await tx.decorationPriceTable.update({ where: { id: table.id }, data: { isPlaceholder: false } });
    });
    revalidatePath(`/admin/methods/${methodId}`);
    revalidatePath("/admin/methods");
    return `Saved ${cells.length} prices`;
  });
}

export async function deletePriceTable(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  return runAction(async () => {
    const methodId = text(form, "methodId");
    const pricingGroupId = text(form, "pricingGroupId"); // the default table can't be deleted
    await db.decorationPriceTable.deleteMany({ where: { methodId, pricingGroupId } });
    revalidatePath(`/admin/methods/${methodId}`);
    return "Group now uses the default prices";
  });
}

export async function saveWorkflow(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["PRODUCTION"]);
  return runAction(async () => {
    const id = text(form, "id");
    const steps = field(form, "steps")
      .split("\n")
      .map((s) => s.trim().slice(0, 80))
      .filter(Boolean);
    if (steps.length === 0) throw new FormError("Add at least one step");
    if (steps.length > 20) throw new FormError("Keep it to 20 steps or fewer");
    const dailyCapacity = optionalInt(field(form, "dailyCapacity"), "Daily capacity");
    if (dailyCapacity === 0) throw new FormError("Daily capacity must be more than 0, or blank for no limit");
    await db.$transaction([
      db.decorationMethod.update({ where: { id }, data: { dailyCapacity } }),
      db.workflowStep.deleteMany({ where: { methodId: id } }),
      db.workflowStep.createMany({ data: steps.map((name, i) => ({ businessId: db.$businessId, methodId: id, name, sortOrder: i })) }),
    ]);
    revalidatePath(`/admin/methods/${id}`);
  });
}
