import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";

/** The signed-in editor and the product a product page section is about. */
export const loadProduct = cache(async (id: string) => {
  const staff = await requireStaff(["SALES", "PURCHASING"]);
  const product = await staff.db.product.findUnique({
    where: { id },
    include: { supplier: true, productType: true, _count: { select: { colors: true, sizes: true, variants: true, views: true } } },
  });
  if (!product) notFound();
  return { staff, db: staff.db, product };
});
