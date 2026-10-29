import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { hasAnyRole } from "@/lib/auth/roles";
import { forBusiness } from "@/lib/db";
import { type PreviewLine, previewPrices } from "@/lib/orders/pricing";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : "");

/** Live prices for lines being designed (POST { orderId?, lines }). */
export async function POST(req: Request) {
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business || !hasAnyRole(staff.roles, ["SALES", "STORE_MANAGER"])) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  let body: { orderId?: unknown; lines?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length > 100) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const lines: PreviewLine[] = body.lines.flatMap((raw): PreviewLine[] => {
    const l = (raw ?? {}) as Record<string, unknown>;
    if (!str(l.productId) || !str(l.colorId)) return [];
    const quantities = Object.fromEntries(Object.entries((l.quantities ?? {}) as Record<string, unknown>).flatMap(([k, v]) => (num(v) ? [[k.slice(0, 40), Math.floor(num(v)!)]] : [])));
    const decorations = (Array.isArray(l.decorations) ? l.decorations : []).slice(0, 20).flatMap((rd) => {
      const d = (rd ?? {}) as Record<string, unknown>;
      if (!str(d.methodId)) return [];
      return [{
        methodId: str(d.methodId),
        location: str(d.location) || "Decoration",
        colors: num(d.colors),
        stitches: num(d.stitches),
        widthIn: num(d.widthIn),
        heightIn: num(d.heightIn),
        needsArtwork: d.needsArtwork === true,
        needsDigitizing: d.needsDigitizing === true,
        reuseScreens: d.reuseScreens === true,
      }];
    });
    return [{ key: str(l.key), lineId: str(l.lineId) || null, productId: str(l.productId), colorId: str(l.colorId), quantities, decorations }];
  });
  const db = forBusiness(business.id);
  const orderId = str(body.orderId) || null;
  // Only this business's orders are visible through its client; an unknown id prices without one.
  return NextResponse.json(await previewPrices(db, { orderId, lines }));
}
