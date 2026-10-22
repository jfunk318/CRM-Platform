"use server";

import type { SupplierIntegration } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, checkbox, FormError, optionalText, runAction, text } from "@/lib/admin/form";
import { slugify } from "@/lib/catalog/products";

const INTEGRATIONS: SupplierIntegration[] = ["REST_API", "PROMOSTANDARDS", "CSV", "MANUAL"];

export async function saveSupplier(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["PURCHASING"]);
  return runAction(async () => {
    const id = optionalText(form, "id");
    const name = text(form, "name", "Name");
    const integration = String(form.get("integration")) as SupplierIntegration;
    if (!INTEGRATIONS.includes(integration)) throw new FormError("Choose how the catalog is loaded");
    const data = {
      name,
      code: slugify(optionalText(form, "code") ?? name),
      integration,
      active: id ? checkbox(form, "active") : true,
    };
    if (id) await db.supplier.update({ where: { id }, data });
    else await db.supplier.create({ data });
    revalidatePath("/admin/suppliers");
    return id ? "Saved" : `Added ${name}`;
  });
}
