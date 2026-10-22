"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, checkbox, FormError, optionalText, percent, runAction, text } from "@/lib/admin/form";

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

export async function saveShopSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const currency = text(form, "currency", "Currency").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new FormError("Currency must be a 3-letter code like USD");
    const data = {
      name: text(form, "shopName", "Business name"),
      currency,
      priceRounding: field(form, "priceRounding") === "UP_TO_99" ? ("UP_TO_99" as const) : ("CENT" as const),
      rushFeePct: percent(field(form, "rushFeePct") || "0", "Rush fee"),
      paymentSurchargePct: percent(field(form, "paymentSurchargePct") || "0", "Card surcharge"),
    };
    // The domain is set by platform admins (see /platform), not here.
    await db.business.update({ where: { id: db.$businessId }, data });
    // The name appears in every page's header and title.
    revalidatePath("/", "layout");
  });
}

function taxData(form: FormData) {
  const postal = field(form, "postalPrefixes")
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    name: text(form, "name", "Tax name"),
    rate: percent(field(form, "rate"), "Rate"),
    country: (optionalText(form, "country") ?? "US").toUpperCase(),
    region: optionalText(form, "region")?.toUpperCase() ?? null,
    postalPrefixes: postal,
    active: checkbox(form, "active"),
    taxShipping: checkbox(form, "taxShipping"),
    taxArtworkFee: checkbox(form, "taxArtworkFee"),
    taxDigitizingFee: checkbox(form, "taxDigitizingFee"),
    taxRushFee: checkbox(form, "taxRushFee"),
    taxScreenSetupFee: checkbox(form, "taxScreenSetupFee"),
    taxPaymentSurcharge: checkbox(form, "taxPaymentSurcharge"),
  };
}

export async function saveTaxRate(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const id = optionalText(form, "id");
    if (id) await db.taxRate.update({ where: { id }, data: taxData(form) });
    else await db.taxRate.create({ data: { ...taxData(form), businessId: db.$businessId } });
    revalidatePath("/admin/settings");
    return id ? "Saved" : "Tax rate added";
  });
}

export async function deleteTaxRate(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    await db.taxRate.delete({ where: { id: text(form, "id") } });
    revalidatePath("/admin/settings");
    return "Deleted";
  });
}
