import { forBusiness } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { fileStore } from "@/lib/files/storage";
import { fileHeaders } from "@/lib/files/types";

/** A business's stored file, for its signed-in staff. ?download=1 forces a download. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const file = await forBusiness(business.id).storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  const bytes = await fileStore.get(file.storageKey);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(bytes), { headers: fileHeaders(file.name, file.size, download) });
}
