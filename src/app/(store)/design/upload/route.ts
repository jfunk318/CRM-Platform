import { NextResponse } from "next/server";
import { ensureCart } from "@/lib/store/cart";
import { designerConfig } from "@/lib/store/designer";
import { getRequestStore } from "@/lib/store/resolve";
import { saveUpload, UploadError } from "@/lib/files/storage";

const MAX_BYTES = 15 * 1024 * 1024;
// Originals (PDF, Illustrator…) kept for printing next to the picture placed from them.
const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;
const ORIGINALS = ["pdf", "ai", "eps", "epsf", "psd", "psb", "tif", "tiff"];
const MAX_PER_CART = 40;
const TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/**
 * Artwork a shopper is designing with (their upload, or text drawn as an
 * image), kept with their cart so only they can use it.
 */
export async function POST(req: Request) {
  const rs = await getRequestStore();
  if (!rs || rs.status.state !== "open") return NextResponse.json({ error: "This store isn't open" }, { status: 404 });
  const config = await designerConfig(rs.db, rs.store);
  if (!config.enabled || (!config.upload && !config.text)) return NextResponse.json({ error: "Uploads aren't available here" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose an image" }, { status: 400 });
  const original = ORIGINALS.includes(file.name.toLowerCase().split(".").pop() ?? "");
  if (!TYPES.has(file.type) && !original) return NextResponse.json({ error: "Use a PNG, JPG, GIF, WebP, PDF, AI, EPS, PSD or TIFF file" }, { status: 400 });
  if (file.size > (original ? MAX_ORIGINAL_BYTES : MAX_BYTES)) return NextResponse.json({ error: `That file is too big (${original ? 50 : 15} MB at most)` }, { status: 400 });
  const cart = await ensureCart(rs);
  if ((await rs.db.cartFile.count({ where: { cartId: cart.id } })) >= MAX_PER_CART) return NextResponse.json({ error: "Too many uploads; remove some and try again" }, { status: 429 });
  try {
    const saved = await saveUpload(rs.db, file, null);
    await rs.db.cartFile.create({ data: { businessId: rs.business.id, cartId: cart.id, fileId: saved.id } });
    return NextResponse.json({ fileId: saved.id });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
