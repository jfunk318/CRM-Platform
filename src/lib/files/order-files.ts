import "server-only";
import type { OrderFileKind, StoredFile } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { logEvent, OrderError } from "@/lib/orders/service";
import { addToLibrary, forgetArtwork, orderOwner } from "@/lib/design/library";
import { fileStore, saveUpload } from "./storage";

export const FILE_KIND_LABELS: Record<OrderFileKind, string> = {
  ARTWORK: "Artwork",
  PRODUCTION: "Production file",
  MOCKUP: "Mockup / proof",
  CUSTOMER: "From customer",
  OTHER: "Other",
};

export async function addOrderFiles(db: BusinessDb, orderId: string, files: File[], kind: OrderFileKind, staffId: string | null) {
  if (files.length === 0) throw new OrderError("Choose at least one file");
  await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const saved: StoredFile[] = [];
  for (const f of files) saved.push(await saveUpload(db, f, staffId));
  const businessId = db.$businessId;
  await db.$transaction(async (tx) => {
    for (const f of saved) await tx.orderFile.create({ data: { businessId, orderId, fileId: f.id, kind } });
    // Artwork is also kept in the customer's library for reuse.
    if (kind === "ARTWORK" || kind === "CUSTOMER") await addToLibrary(tx, await orderOwner(tx, orderId), saved);
    await logEvent(tx, businessId, orderId, "FILE", `Added ${saved.map((f) => f.name).join(", ")}`, staffId);
  });
  return saved.length;
}

/**
 * Remove a file from an order. It also leaves the customer's artwork library
 * (with any copies of the same image), so the designer stops offering it.
 * The stored file is kept while anything else (another order, a proof, a
 * placed design) still uses it.
 */
export async function removeOrderFile(db: BusinessDb, orderFileId: string, staffId: string | null) {
  const link = await db.orderFile.findUniqueOrThrow({ where: { id: orderFileId }, include: { file: true } });
  await db.orderFile.delete({ where: { id: link.id } });
  // Removed artwork stops being offered in the designer for this customer (copies too).
  await forgetArtwork(db, await orderOwner(db, link.orderId), link.fileId);
  // The file itself goes once nothing else uses it.
  const file = await db.storedFile.findUnique({
    where: { id: link.fileId },
    include: { _count: { select: { orderFiles: true, proofFiles: true, artworkFor: true, artSourceFor: true, artworkAssets: true, storeLogos: true, storeHeroes: true, storeItems: true, cartFiles: true, cartImages: true } } },
  });
  if (file && Object.values(file._count).every((n) => n === 0)) {
    await db.storedFile.delete({ where: { id: file.id } });
    await fileStore.remove(file.storageKey);
  }
  await logEvent(db, db.$businessId, link.orderId, "FILE", `Removed ${link.file.name}`, staffId);
}
