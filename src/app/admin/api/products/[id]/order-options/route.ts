import { NextResponse } from "next/server";
import { forBusiness } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { hasAnyRole } from "@/lib/auth/roles";
import { guidesFrom, type PlacementGuide } from "@/lib/design/guides";

export type OrderOptions = {
  id: string;
  name: string;
  styleCode: string;
  colors: { id: string; name: string; hex: string | null; image: string | null; sizeIds: string[] }[];
  sizes: { id: string; code: string }[];
  methods: { id: string; name: string; pricingModel: string; minQty: number; maxColors: number | null; minDpi: number | null; perfectDpi: number | null; stitchDensity: number }[];
  /** Print areas, with their box on the view's photo (fractions of the photo). */
  areas: { id: string; label: string; viewId: string; widthIn: number; heightIn: number; x: number; y: number; w: number; h: number }[];
  /** Each view's photo per color id. */
  views: { id: string; name: string; photos: Record<string, string> }[];
  /** The business's placement guidelines (sizes for left chest, full front…). */
  guides: PlacementGuide[];
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
      views: { orderBy: { sortOrder: "asc" }, include: { areas: true, images: true } },
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
      // The first view that has a photo in this color.
      image: p.views.map((v) => v.images.find((i) => i.colorId === c.id)?.url).find(Boolean) ?? null,
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
        minDpi: m.minDpi,
        perfectDpi: m.perfectDpi,
        stitchDensity: m.stitchDensity,
      })),
    areas: p.views.flatMap((v) =>
      v.areas.map((a) => ({
        id: a.id,
        label: `${v.name} / ${a.name}`,
        viewId: v.id,
        widthIn: a.widthIn.toNumber(),
        heightIn: a.heightIn.toNumber(),
        x: a.x,
        y: a.y,
        w: a.w,
        h: a.h,
      })),
    ),
    views: p.views.map((v) => ({ id: v.id, name: v.name, photos: Object.fromEntries(v.images.map((i) => [i.colorId, i.url])) })),
    guides: guidesFrom(business.placementGuides),
  };
  return NextResponse.json(body);
}
