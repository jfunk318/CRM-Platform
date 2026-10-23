import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { forBusiness } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { hasAnyRole } from "@/lib/auth/roles";
import { productSearch } from "@/lib/catalog/search";
import { productThumbnails } from "@/lib/catalog/thumbnails";

export type ProductHit = { id: string; name: string; styleCode: string; brand: string | null; status: string; thumbnail: string | null };

const LIMIT = 20;

/** Products matching a style code, name or brand, for the product picker. */
export async function GET(req: NextRequest) {
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business || !hasAnyRole(staff.roles, ["SALES", "STORE_MANAGER"])) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const db = forBusiness(business.id);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const all = req.nextUrl.searchParams.get("all") === "1";
  const base: Prisma.ProductWhereInput = { variants: { some: {} }, ...(all ? {} : { status: { not: "DISCONTINUED" } }) };
  const select = { id: true, name: true, styleCode: true, brand: true, status: true } as const;
  const orderBy = [{ name: "asc" as const }, { styleCode: "asc" as const }];
  // Style codes that start with what was typed come first ("5000" → 5000, 5000B, 5000L before DT5000).
  const byStyle = q ? await db.product.findMany({ where: { ...base, styleCode: { startsWith: q, mode: "insensitive" } }, select, orderBy: { styleCode: "asc" }, take: LIMIT }) : [];
  const rest = await db.product.findMany({
    where: {
      ...base,
      id: { notIn: byStyle.map((p) => p.id) },
      ...productSearch(q),
    },
    select,
    orderBy,
    take: LIMIT - byStyle.length,
  });
  const found = [...byStyle, ...rest];
  const thumbs = await productThumbnails(business.id, found.map((p) => p.id));
  const hits: ProductHit[] = found.map((p) => ({ ...p, thumbnail: thumbs.get(p.id) ?? null }));
  return NextResponse.json(hits);
}
