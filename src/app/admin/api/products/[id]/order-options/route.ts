import { NextResponse } from "next/server";
import { forBusiness } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { hasAnyRole } from "@/lib/auth/roles";

export type OrderOptions = {
  id: string;
  name: string;
  styleCode: string;
  colors: { id: string; name: string; hex: string | null; sizeIds: string[] }[];
  sizes: { id: string; code: string }[];
  methods: { id: string; name: string; pricingModel: string; minQty: number; maxColors: number | null }[];
  areas: { id: string; label: string; widthIn: number; heightIn: number }[];
};

/** What the order line editor needs to configure one product. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // getCurrentStaff only returns staff of the business this host belongs to.
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business || !hasAnyRole(staff.roles, ["SALES", "STORE_MANAGER"])) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const db = forBusiness(business.id);
  const { id } = await params;
  const p = await db.product.findUnique({
    where: { id },
    include: {
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: { where: { active: true }, select: { colorId: true, sizeId: true } },
      views: { orderBy: { sortOrder: "asc" }, include: { areas: true } },
      methodRules: true,
      productType: { include: { decorationMethods: { include: { method: true } } } },
    },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: OrderOptions = {
    id: p.id,
    name: p.name,
    styleCode: p.styleCode,
    colors: p.colors.map((c) => ({
      id: c.id,
      name: c.name,
      hex: c.hex,
      sizeIds: p.variants.filter((v) => v.colorId === c.id).map((v) => v.sizeId),
    })),
    sizes: p.sizes.map((s) => ({ id: s.id, code: s.code })),
    methods: p.productType.decorationMethods
      .map((d) => d.method)
      .filter((m) => m.active && p.methodRules.find((r) => r.methodId === m.id)?.enabled !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        id: m.id,
        name: m.shortName,
        pricingModel: m.pricingModel,
        minQty: Math.max(m.minQty, p.methodRules.find((r) => r.methodId === m.id)?.minQty ?? 0),
        maxColors: m.maxColors,
      })),
    areas: p.views.flatMap((v) =>
      v.areas.map((a) => ({ id: a.id, label: `${v.name} / ${a.name}`, widthIn: a.widthIn.toNumber(), heightIn: a.heightIn.toNumber() })),
    ),
  };
  return NextResponse.json(body);
}
