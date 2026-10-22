import { getRequestStore } from "@/lib/store/resolve";
import { fileStore } from "@/lib/files/storage";
import { fileHeaders, isImage } from "@/lib/files/types";

/** Public storefront images: a store's logo or a published item's picture. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rs = await getRequestStore();
  if (!rs) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const file = await rs.db.storedFile.findFirst({
    where: { id, OR: [{ storeLogos: { some: {} } }, { storeItems: { some: { published: true } } }] },
  });
  if (!file || !isImage(file.name)) return new Response("Not found", { status: 404 });
  const bytes = await fileStore.get(file.storageKey);
  return new Response(new Uint8Array(bytes), { headers: { ...fileHeaders(file.name, file.size), "Cache-Control": "public, max-age=86400" } });
}
