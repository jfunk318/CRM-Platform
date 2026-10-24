import { NextResponse } from "next/server";
import { type BusinessDb, forBusiness } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { hasAnyRole } from "@/lib/auth/roles";
import { formFiles, saveUpload, UploadError } from "@/lib/files/storage";
import { extensionOf } from "@/lib/files/types";
import { PLACEABLE, type LibraryArt } from "@/lib/design/artwork";
import { addToLibrary, type ArtOwner, libraryFor, touchArtwork } from "@/lib/design/library";

async function staffDb() {
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business || !hasAnyRole(staff.roles, ["SALES", "ARTWORK", "ARTWORK_MANAGER", "STORE_MANAGER"])) return null;
  return { staff, db: forBusiness(business.id) };
}

/** Customer/company ids from the request, kept only if they're this business's. */
async function ownerFrom(db: BusinessDb, get: (k: string) => string | null): Promise<ArtOwner> {
  const customerId = get("customerId") || null;
  const companyId = get("companyId") || null;
  const [customer, company] = await Promise.all([
    customerId ? db.customer.findUnique({ where: { id: customerId }, select: { id: true, companyId: true } }) : null,
    companyId ? db.company.findUnique({ where: { id: companyId }, select: { id: true } }) : null,
  ]);
  return { customerId: customer?.id ?? null, companyId: company?.id ?? customer?.companyId ?? null };
}

/** The customer's (and their company's) artwork library, for the design studio's gallery. */
export async function GET(req: Request) {
  const ctx = await staffDb();
  if (!ctx) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const params = new URL(req.url).searchParams;
  const owner = await ownerFrom(ctx.db, (k) => params.get(k));
  const assets = await libraryFor(ctx.db, owner);
  const body: LibraryArt[] = assets.map((a) => ({
    fileId: a.fileId,
    name: a.name,
    owner: a.customer ? `${a.customer.firstName} ${a.customer.lastName}`.trim() : "Company",
    addedAt: a.createdAt.toISOString(),
  }));
  return NextResponse.json(body);
}

/**
 * Save artwork from the design studio: the edited PNG used in mockups and,
 * for a new upload, the original (which goes into the customer's library).
 * Returns their ids for the item form.
 */
export async function POST(req: Request) {
  const ctx = await staffDb();
  if (!ctx) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { db, staff } = ctx;
  const form = await req.formData();
  const [artwork] = formFiles(form, "artwork");
  const [source] = formFiles(form, "source");
  if (!artwork || extensionOf(artwork.name) !== "png") return NextResponse.json({ error: "The edited artwork must be a PNG" }, { status: 400 });
  if (source && !PLACEABLE.includes(extensionOf(source.name))) return NextResponse.json({ error: "Upload a PNG, JPG, GIF, WebP or SVG" }, { status: 400 });
  try {
    const art = await saveUpload(db, artwork, staff.id);
    const src = source ? await saveUpload(db, source, staff.id) : null;
    if (src) await addToLibrary(db, await ownerFrom(db, (k) => String(form.get(k) ?? "")), [src]);
    const fromLibrary = String(form.get("libraryFileId") ?? "");
    if (src || fromLibrary) await touchArtwork(db, src?.id ?? fromLibrary);
    return NextResponse.json({ artworkFileId: art.id, sourceFileId: src?.id ?? null });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
