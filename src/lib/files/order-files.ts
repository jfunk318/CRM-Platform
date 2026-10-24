import "server-only";
import type { OrderFileKind, StoredFile } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { logEvent, OrderError } from "@/lib/orders/service";
import { addToLibrary, orderOwner } from "@/lib/design/library";
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
 * (unless another order still lists it). The stored file is kept if a proof
 * or a placed design still uses it.
 */
export async function removeOrderFile(db: BusinessDb, orderFileId: string, staffId: string | null) {
  const link = await db.orderFile.findUniqueOrThrow({ where: { id: orderFileId }, include: { file: true } });
  await db.orderFile.delete({ where: { id: link.id } });
  const elsewhere = await db.orderFile.count({ where: { fileId: link.fileId } });
  if (elsewhere === 0) await db.artworkAsset.deleteMany({ where: { fileId: link.fileId } });
  const { proofFiles, artworkFor, artSourceFor, artworkAssets } = (
    await db.storedFile.findUniqueOrThrow({ where: { id: link.fileId }, include: { _count: { select: { proofFiles: true, artworkFor: true, artSourceFor: true, artworkAssets: true } } } })
  )._count;
  if (elsewhere + proofFiles + artworkFor + artSourceFor + artworkAssets === 0) {
    await db.storedFile.delete({ where: { id: link.fileId } });
    await fileStore.remove(link.file.storageKey);
  }
  await logEvent(db, db.$businessId, link.orderId, "FILE", `Removed ${link.file.name}`, staffId);
}
