import "server-only";
import type { OrderFileKind, StoredFile } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { logEvent, OrderError } from "@/lib/orders/service";
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
    await logEvent(tx, businessId, orderId, "FILE", `Added ${saved.map((f) => f.name).join(", ")}`, staffId);
  });
  return saved.length;
}

/** Remove a file from an order. The stored file is kept if a proof still shows it. */
export async function removeOrderFile(db: BusinessDb, orderFileId: string, staffId: string | null) {
  const link = await db.orderFile.findUniqueOrThrow({ where: { id: orderFileId }, include: { file: { include: { _count: { select: { proofFiles: true } } } } } });
  await db.orderFile.delete({ where: { id: link.id } });
  if (link.file._count.proofFiles === 0) {
    await db.storedFile.delete({ where: { id: link.fileId } });
    await fileStore.remove(link.file.storageKey);
  }
  await logEvent(db, db.$businessId, link.orderId, "FILE", `Removed ${link.file.name}`, staffId);
}
