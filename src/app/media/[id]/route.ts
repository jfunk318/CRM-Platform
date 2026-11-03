import { getRequestStore } from "@/lib/store/resolve";
import { fileStore } from "@/lib/files/storage";
import { fileHeaders, isImage } from "@/lib/files/types";
import { parseSections, sectionImages } from "@/lib/store/homepage";

/** Public storefront images: a store's logo, banner or favicon, the main site's homepage photos, a published item's picture, a cart design's mockup, or team logos for the designer. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rs = await getRequestStore();
  if (!rs) return new Response("Not found", { status: 404 });
  const { id } = await params;
  // The store owner's artwork, when the store's designer lets shoppers use it.
  const library = rs.store.designerEnabled && rs.store.designerLibrary && rs.store.customerId ? [{ artworkAssets: { some: { customerId: rs.store.customerId } } }] : [];
  // Photos on the main site's homepage.
  const homepage = rs.store.kind === "ROOT" && sectionImages(parseSections(rs.store.homeSections)).includes(id) ? [{ id }] : [];
  const file = await rs.db.storedFile.findFirst({
    where: { id, OR: [...homepage, { storeLogos: { some: {} } }, { storeHeroes: { some: {} } }, { storeIcons: { some: {} } }, { storeItems: { some: { published: true } } }, { cartImages: { some: {} } }, ...library] },
  });
  if (!file || !(isImage(file.name) || file.name.toLowerCase().endsWith(".ico"))) return new Response("Not found", { status: 404 });
  const bytes = await fileStore.get(file.storageKey);
  return new Response(new Uint8Array(bytes), { headers: { ...fileHeaders(file.name, file.size), "Cache-Control": "public, max-age=86400" } });
}
