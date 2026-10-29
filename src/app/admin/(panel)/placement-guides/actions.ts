"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { all, type ActionResult, FormError, runAction } from "@/lib/admin/form";
import type { PlacementGuide } from "@/lib/design/guides";

export async function saveGuidesAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const [names, keywords, widths, heights, aligns] = ["name", "keywords", "maxWidthIn", "maxHeightIn", "align"].map((n) => all(form, n));
    const guides: PlacementGuide[] = names.flatMap((name, i) => {
      if (!name) return [];
      const words = keywords[i].split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
      const w = Number(widths[i]);
      const h = Number(heights[i]);
      if (!words.length) throw new FormError(`${name}: list the area names it applies to`);
      if (!(w > 0 && w <= 60) || !(h > 0 && h <= 60)) throw new FormError(`${name}: sizes must be between 0 and 60 inches`);
      const align = aligns[i] === "center" || aligns[i] === "bottom" ? aligns[i] : "top";
      return [{ name, keywords: words, maxWidthIn: w, maxHeightIn: h, align } as PlacementGuide];
    });
    await db.business.update({ where: { id: db.$businessId }, data: { placementGuides: guides as unknown as Prisma.InputJsonArray } });
    revalidatePath("/admin/placement-guides");
  });
}

export async function resetGuidesAction(): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    await db.business.update({ where: { id: db.$businessId }, data: { placementGuides: Prisma.DbNull } });
    revalidatePath("/admin/placement-guides");
    return "Back to the standard guides";
  });
}
