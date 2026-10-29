import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { FormError } from "@/lib/admin/form";
import { parseLineJson } from "@/lib/admin/line-form";
import { OrderError } from "@/lib/orders/service";
import { designerConfig } from "@/lib/store/designer";
import { addDesignToCart } from "@/lib/store/designer-cart";
import { getRequestStore } from "@/lib/store/resolve";

/** Add the shopper's design to their cart (POST the designer's JSON). */
export async function POST(req: Request) {
  const rs = await getRequestStore();
  if (!rs || rs.status.state !== "open") return NextResponse.json({ error: "This store isn't taking orders right now" }, { status: 404 });
  const config = await designerConfig(rs.db, rs.store);
  if (!config.enabled) return NextResponse.json({ error: "The designer isn't available here" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    // Read like a staff item, then re-checked against the shopper's rules.
    const spec = parseLineJson({ ...body, notes: "" }, "Your design");
    await addDesignToCart(rs, config, { productId: spec.productId, colorId: spec.colorId, quantities: spec.quantities, decorations: spec.decorations, lowResOk: body.lowResOk === true });
  } catch (e) {
    if (e instanceof OrderError || e instanceof FormError) return NextResponse.json({ error: e.message.replace(/^Your design: /, "") }, { status: 422 });
    throw e;
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
