import { getRequestStore } from "@/lib/store/resolve";
import { fileStore } from "@/lib/files/storage";
import { fileHeaders, isImage } from "@/lib/files/types";

/** Public storefront images: a store's logo or banner, a published item's picture, a cart design's mockup, or team logos for the designer. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rs = await getRequestStore();
  if (!rs) return new Response("Not found", { status: 404 });
  const { id } = await params;
  // The store owner's artwork, when the store's designer lets shoppers use it.
  const library = rs.store.designerEnabled && rs.store.designerLibrary && rs.store.customerId ? [{ artworkAssets: { some: { customerId: rs.store.customerId } } }] : [];
  const file = await rs.db.storedFile.findFirst({
    where: { id, OR: [{ storeLogos: { some: {} } }, { storeHeroes: { some: {} } }, { storeItems: { some: { published: true } } }, { cartImages: { some: {} } }, ...library] },
  });
  if (!file || !isImage(file.name)) return new Response("Not found", { status: 404 });
  const bytes = await fileStore.get(file.storageKey);
  return new Response(new Uint8Array(bytes), { headers: { ...fileHeaders(file.name, file.size), "Cache-Control": "public, max-age=86400" } });
}
