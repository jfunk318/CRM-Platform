"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { all, type ActionResult, checkbox, FormError, runAction, text } from "@/lib/admin/form";
import { parseDiscountTiers, parseMarkupTiers } from "@/lib/admin/validate";

const done = () => revalidatePath("/admin/pricing");

export async function savePricingGroup(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const id = text(form, "id");
    const name = text(form, "name", "Name");
    const markupMode = form.get("markupMode") === "MARGIN" ? "MARGIN" : "MARKUP";
    const isDefault = checkbox(form, "isDefault");
    const tiers = parseMarkupTiers(all(form, "costFrom"), all(form, "costTo"), all(form, "pct"));
    await db.$transaction(async (tx) => {
      if (isDefault) await tx.pricingGroup.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      await tx.pricingGroup.update({ where: { id }, data: { name, markupMode, isDefault } });
      await tx.markupTier.deleteMany({ where: { pricingGroupId: id } });
      await tx.markupTier.createMany({ data: tiers.map((t) => ({ ...t, pricingGroupId: id })) });
    });
    done();
  });
}

export async function createPricingGroup(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const name = text(form, "name", "Name");
    const base = await db.pricingGroup.findFirst({ where: { isDefault: true }, include: { markupTiers: true } });
    await db.pricingGroup.create({
      data: {
        name,
        markupMode: base?.markupMode ?? "MARKUP",
        // Start from the default group's tiers so the new group prices sensibly right away.
        markupTiers: {
          create: base?.markupTiers.map(({ costFrom, costTo, pct }) => ({ costFrom, costTo, pct })) ?? [
            { costFrom: 0, costTo: null, pct: 0.4 },
          ],
        },
      },
    });
    done();
    return `Created ${name}`;
  });
}

export async function deletePricingGroup(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const group = await db.pricingGroup.findUniqueOrThrow({ where: { id: text(form, "id") } });
    if (group.isDefault) throw new FormError("Make another group the default before deleting this one");
    await db.pricingGroup.delete({ where: { id: group.id } });
    done();
    return "Deleted";
  });
}

export async function saveQuantityDiscount(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const id = text(form, "id");
    const name = text(form, "name", "Name");
    const tiers = parseDiscountTiers(all(form, "minQty"), all(form, "pct"));
    await db.$transaction([
      db.quantityDiscount.update({ where: { id }, data: { name } }),
      db.quantityDiscountTier.deleteMany({ where: { discountId: id } }),
      db.quantityDiscountTier.createMany({ data: tiers.map((t) => ({ ...t, discountId: id })) }),
    ]);
    done();
  });
}

export async function createQuantityDiscount(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const name = text(form, "name", "Name");
    const tiers = parseDiscountTiers(all(form, "minQty"), all(form, "pct"));
    await db.quantityDiscount.create({ data: { name, tiers: { create: tiers } } });
    done();
    return `Created ${name}`;
  });
}

export async function deleteQuantityDiscount(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const id = text(form, "id");
    const inUse = await db.product.count({ where: { quantityDiscountId: id } });
    if (inUse) throw new FormError(`Used by ${inUse} product${inUse === 1 ? "" : "s"}; remove it from them first`);
    await db.quantityDiscount.delete({ where: { id } });
    done();
    return "Deleted";
  });
}
