"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, FormError, int, optionalText, runAction, text } from "@/lib/admin/form";
import { slugify } from "@/lib/catalog/products";

async function checkParent(id: string | null, parentId: string | null) {
  if (!parentId) return;
  // Walk up from the new parent; reaching this category would create a loop.
  for (let cur: string | null = parentId; cur; ) {
    if (cur === id) throw new FormError("A category can't be inside itself or one of its subcategories");
    cur = (await db.category.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
  }
}

export async function saveCategory(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const id = optionalText(form, "id");
    const name = text(form, "name", "Name");
    const parentId = optionalText(form, "parentId");
    await checkParent(id, parentId);
    const data = {
      name,
      slug: slugify(optionalText(form, "slug") ?? name),
      parentId,
      description: optionalText(form, "description"),
      sortOrder: int(String(form.get("sortOrder") ?? "") || "0", "Sort order"),
    };
    if (!data.slug) throw new FormError("Slug can't be empty");
    if (id) await db.category.update({ where: { id }, data });
    else await db.category.create({ data });
    revalidatePath("/admin/categories");
    return id ? "Saved" : `Added ${name}`;
  });
}

export async function deleteCategory(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const id = text(form, "id");
    const [children, products] = await Promise.all([
      db.category.count({ where: { parentId: id } }),
      db.productCategory.count({ where: { categoryId: id } }),
    ]);
    if (children) throw new FormError("Move or delete its subcategories first");
    if (products) throw new FormError(`Remove its ${products} product(s) first`);
    await db.category.delete({ where: { id } });
    revalidatePath("/admin/categories");
    return "Deleted";
  });
}
