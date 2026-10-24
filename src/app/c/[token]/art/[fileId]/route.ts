import { forBusiness } from "@/lib/db";
import { getRequestBusiness } from "@/lib/business";
import { fileStore } from "@/lib/files/storage";
import { fileHeaders } from "@/lib/files/types";

/** Placed artwork on a quote or order, for whoever holds its customer link (for mockups). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const business = await getRequestBusiness();
  if (!business || business.status !== "ACTIVE") return new Response("Not found", { status: 404 });
  const { token, fileId } = await params;
  if (!token || token.length < 20) return new Response("Not found", { status: 404 });
  const db = forBusiness(business.id);
  // Only the edited artwork shown in mockups, and only on this order's items.
  const placed = await db.designDecoration.findFirst({
    where: { artworkFileId: fileId, design: { orderLines: { some: { order: { publicToken: token } } } } },
    include: { artwork: true },
  });
  if (!placed?.artwork) return new Response("Not found", { status: 404 });
  const bytes = await fileStore.get(placed.artwork.storageKey);
  return new Response(new Uint8Array(bytes), { headers: fileHeaders(placed.artwork.name, placed.artwork.size) });
}
