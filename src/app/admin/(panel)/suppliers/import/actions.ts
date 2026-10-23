"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, FormError, runAction, text } from "@/lib/admin/form";
import { fileStore } from "@/lib/files/storage";
import { createCatalogImport, ImportFileError, startCatalogImport } from "@/lib/catalog/import/run";
import type { ImportOptions } from "@/lib/catalog/import/sanmar";

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ImportFileError) throw new FormError(e.message);
      throw e;
    }
  });
}

export async function uploadImportAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  let id = "";
  const r = await run(async () => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new FormError("Choose the file from SanMar");
    id = await createCatalogImport(staff.db, { supplierId: text(form, "supplierId", "Supplier"), file, staffId: staff.id });
  });
  if (r.error) return r;
  redirect(`/admin/suppliers/import/${id}`);
}

export async function startImportAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "id");
  return run(async () => {
    const cost = String(form.get("cost") ?? "piece");
    if (!["piece", "dozen", "case"].includes(cost)) throw new FormError("Choose which price to use as your cost");
    const brands = form.getAll("brands").map(String);
    const categories = form.getAll("categories").map(String);
    if (brands.length === 0) throw new FormError("Choose at least one brand");
    const options: ImportOptions = {
      brands: form.get("allBrands") === "on" ? null : brands,
      categories: form.get("allCategories") === "on" ? null : categories,
      includeDiscontinued: form.get("includeDiscontinued") === "on",
      cost: cost as ImportOptions["cost"],
    };
    const n = await startCatalogImport(staff.db, id, options);
    revalidatePath(`/admin/suppliers/import/${id}`);
    return `Importing ${n} style${n === 1 ? "" : "s"}…`;
  });
}

export async function deleteImportAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["PURCHASING"]);
  const r = await run(async () => {
    const imp = await db.catalogImport.findUniqueOrThrow({ where: { id: text(form, "id") } });
    if (imp.status === "RUNNING" && imp.updatedAt > new Date(Date.now() - 10 * 60_000)) throw new FormError("Wait for the import to finish");
    await fileStore.remove(imp.storageKey);
    await db.catalogImport.delete({ where: { id: imp.id } });
  });
  if (r.error) return r;
  redirect("/admin/suppliers/import");
}
