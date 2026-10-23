import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Each product's thumbnail: the photo for its first view in its first color
 * (so the list matches what the product page and catalog show first).
 */
export async function productThumbnails(businessId: string, productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ productId: string; url: string }[]>`
    SELECT DISTINCT ON (v."productId") v."productId", i.url
    FROM "ViewImage" i
    JOIN "ProductView" v ON v.id = i."viewId"
    JOIN "ProductColor" c ON c.id = i."colorId"
    WHERE i."businessId" = ${businessId} AND v."productId" IN (${Prisma.join(productIds)})
    ORDER BY v."productId", v."sortOrder", c."sortOrder"`;
  return new Map(rows.map((r) => [r.productId, r.url]));
}

/** The first view's photo for each color, keyed by color id. */
export async function colorThumbnails(businessId: string, colorIds: string[]): Promise<Map<string, string>> {
  if (colorIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ colorId: string; url: string }[]>`
    SELECT DISTINCT ON (i."colorId") i."colorId", i.url
    FROM "ViewImage" i
    JOIN "ProductView" v ON v.id = i."viewId"
    WHERE i."businessId" = ${businessId} AND i."colorId" IN (${Prisma.join(colorIds)})
    ORDER BY i."colorId", v."sortOrder"`;
  return new Map(rows.map((r) => [r.colorId, r.url]));
}
