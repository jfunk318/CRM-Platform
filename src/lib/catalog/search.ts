import type { Prisma } from "@prisma/client";

/**
 * Products matching every word typed, each in the name, style code or brand
 * ("gildan 5000" finds Gildan's 5000).
 */
export function productSearch(q: string): Prisma.ProductWhereInput {
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length === 0) return {};
  return {
    AND: words.map((w) => ({
      OR: [{ name: { contains: w, mode: "insensitive" } }, { styleCode: { contains: w, mode: "insensitive" } }, { brand: { contains: w, mode: "insensitive" } }],
    })),
  };
}
