import { forBusiness } from "@/lib/db";
import { getRequestBusiness } from "@/lib/business";
import { fileStore } from "@/lib/files/storage";
import { fileHeaders } from "@/lib/files/types";

/** A file on a proof, for whoever holds the proof's link. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const business = await getRequestBusiness();
  if (!business || business.status !== "ACTIVE") return new Response("Not found", { status: 404 });
  const { token, fileId } = await params;
  const link = await forBusiness(business.id).proofFile.findFirst({
    where: { fileId, proof: { token, status: { not: "DRAFT" } } },
    include: { file: true },
  });
  if (!link) return new Response("Not found", { status: 404 });
  const bytes = await fileStore.get(link.file.storageKey);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(bytes), { headers: fileHeaders(link.file.name, link.file.size, download) });
}
