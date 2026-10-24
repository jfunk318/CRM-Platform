import { NextResponse } from "next/server";
import { forBusiness } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { hasAnyRole } from "@/lib/auth/roles";
import { formFiles, saveUpload, UploadError } from "@/lib/files/storage";
import { extensionOf } from "@/lib/files/types";
import { PLACEABLE } from "@/lib/design/artwork";

/**
 * Save artwork from the design studio: the edited PNG used in mockups and,
 * for a new upload, the original file. Returns their ids for the item form.
 */
export async function POST(req: Request) {
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business || !hasAnyRole(staff.roles, ["SALES", "ARTWORK", "ARTWORK_MANAGER", "STORE_MANAGER"])) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const db = forBusiness(business.id);
  const form = await req.formData();
  const [artwork] = formFiles(form, "artwork");
  const [source] = formFiles(form, "source");
  if (!artwork || extensionOf(artwork.name) !== "png") return NextResponse.json({ error: "The edited artwork must be a PNG" }, { status: 400 });
  if (source && !PLACEABLE.includes(extensionOf(source.name))) return NextResponse.json({ error: "Upload a PNG, JPG, GIF, WebP or SVG" }, { status: 400 });
  try {
    const art = await saveUpload(db, artwork, staff.id);
    const src = source ? await saveUpload(db, source, staff.id) : null;
    return NextResponse.json({ artworkFileId: art.id, sourceFileId: src?.id ?? null });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
