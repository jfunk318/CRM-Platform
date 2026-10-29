import { NextResponse } from "next/server";
import { estimateStitches } from "@/lib/design/guides";
import { OrderError } from "@/lib/orders/service";
import { designerConfig, designerProduct, shopperPrices } from "@/lib/store/designer";
import { getRequestStore } from "@/lib/store/resolve";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Live prices while a shopper designs: per size, and the total for what they've entered. */
export async function POST(req: Request) {
  const rs = await getRequestStore();
  if (!rs) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const config = await designerConfig(rs.db, rs.store);
  if (!config.enabled) return NextResponse.json({ error: "Not available" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const product = body && typeof body.productId === "string" ? await designerProduct(rs.db, rs.store, config, { id: body.productId }) : null;
  if (!body || !product || typeof body.colorId !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const quantities = Object.fromEntries(Object.entries((body.quantities ?? {}) as Record<string, unknown>).flatMap(([k, v]) => (num(v) ? [[k, Math.floor(num(v)!)]] : [])));
  const decorations = (Array.isArray(body.decorations) ? body.decorations : []).slice(0, 6).flatMap((raw) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const method = product.methods.find((m) => m.id === d.methodId);
    const area = product.areas.find((a) => a.id === d.areaId);
    if (!method || !area) return [];
    const widthIn = num(d.widthIn) ?? 0;
    const heightIn = num(d.heightIn) ?? 0;
    return [{
      methodId: method.id,
      location: area.label,
      widthIn,
      heightIn,
      colors: method.pricingModel === "PER_COLOR" ? Math.max(1, Math.floor(num(d.colors) ?? 1)) : null,
      stitches: method.pricingModel === "PER_STITCH" ? estimateStitches(widthIn, heightIn, num(d.coverage), method.stitchDensity) : null,
    }];
  });
  if (decorations.length === 0) return NextResponse.json({ sizes: {}, qty: 0, example: true, total: null, stitches: [] });
  const minQty = Math.max(1, ...decorations.map((d) => product.methods.find((m) => m.id === d.methodId)!.minQty));
  try {
    const p = await shopperPrices(rs.db, rs.store, { productId: product.id, colorId: body.colorId, quantities, decorations, minQty });
    return NextResponse.json({
      sizes: Object.fromEntries([...p.unit].map(([k, v]) => [k, v.toFixed(2)])),
      qty: p.qty,
      example: p.example,
      total: p.total?.toFixed(2) ?? null,
      minQty,
      stitches: decorations.map((d) => d.stitches),
    });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message, minQty }, { status: 422 });
    throw e;
  }
}
