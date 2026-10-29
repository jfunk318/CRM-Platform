import "server-only";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { fileStore, saveUpload } from "@/lib/files/storage";
import { extensionOf } from "@/lib/files/types";
import { OrderError } from "@/lib/orders/service";
import { PLACEABLE } from "./artwork";

// Each customer's artwork library: images uploaded for them (on quotes and
// orders, in the design studio, from their quote requests) kept for reuse.
// Anything filed under a company is shared by all of its customers.

export type ArtOwner = { customerId: string | null; companyId: string | null };

export const isPlaceable = (name: string) => PLACEABLE.includes(extensionOf(name));

const ownerWhere = (owner: ArtOwner) => [
  ...(owner.customerId ? [{ customerId: owner.customerId }] : []),
  ...(owner.companyId ? [{ companyId: owner.companyId }] : []),
];

/**
 * File placeable uploads in the owner's library: once per file, and not at
 * all if the same image (by content) is already in the customer's or
 * company's library.
 */
export async function addToLibrary(tx: BusinessTx, owner: ArtOwner, files: { id: string; name: string; sha256: string }[]) {
  if (!owner.customerId && !owner.companyId) return;
  for (const f of files.filter((f) => isPlaceable(f.name))) {
    const exists = await tx.artworkAsset.findFirst({ where: { OR: [{ fileId: f.id }, { file: { sha256: f.sha256 }, OR: ownerWhere(owner) }] } });
    if (!exists) await tx.artworkAsset.create({ data: { businessId: tx.$businessId, fileId: f.id, customerId: owner.customerId, companyId: owner.companyId, name: f.name } });
  }
}

/** Who an order's artwork belongs to: its customer, and the order's (or customer's) company. */
export async function orderOwner(tx: BusinessTx, orderId: string): Promise<ArtOwner> {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { customerId: true, companyId: true, customer: { select: { companyId: true } } } });
  return { customerId: o.customerId, companyId: o.companyId ?? o.customer.companyId };
}

/** A customer's artwork plus their company's, most recently used or added first, each image once. */
export async function libraryFor(tx: BusinessTx, owner: ArtOwner) {
  const or = ownerWhere(owner);
  if (or.length === 0) return [];
  const assets = await tx.artworkAsset.findMany({
    where: { OR: or },
    include: { file: { select: { id: true, name: true, size: true, sha256: true } }, customer: { select: { firstName: true, lastName: true } } },
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 300,
  });
  // The same image uploaded more than once shows once (the most recent).
  const seen = new Set<string>();
  return assets.filter((a) => !seen.has(a.file.sha256) && !!seen.add(a.file.sha256)).slice(0, 200);
}

/** Upload images straight into a library (from the customer or company page). */
export async function uploadToLibrary(db: BusinessDb, owner: ArtOwner, files: File[], staffId: string | null) {
  if (files.length === 0) throw new OrderError("Choose at least one image");
  const bad = files.find((f) => !isPlaceable(f.name));
  if (bad) throw new OrderError(`${bad.name}: artwork must be a PNG, JPG, GIF, WebP or SVG (put other files on an order)`);
  const saved = [];
  for (const f of files) saved.push(await saveUpload(db, f, staffId));
  await addToLibrary(db, owner, saved);
  return saved.length;
}

/**
 * Take artwork out of the library. The file itself is deleted only if
 * nothing else (an order, a proof, a placed design) uses it.
 */
export async function removeFromLibrary(db: BusinessDb, assetId: string) {
  const asset = await db.artworkAsset.findUniqueOrThrow({
    where: { id: assetId },
    include: { file: { include: { _count: { select: { orderFiles: true, proofFiles: true, artworkFor: true, artSourceFor: true, storeLogos: true, storeHeroes: true, storeItems: true, cartFiles: true, cartImages: true } } } } },
  });
  await db.artworkAsset.delete({ where: { id: asset.id } });
  if (Object.values(asset.file._count).every((n) => n === 0)) {
    await db.storedFile.delete({ where: { id: asset.fileId } });
    await fileStore.remove(asset.file.storageKey);
  }
}

/**
 * Delete an image from a customer's (and their company's) library, with any
 * other copies of the same image there, so it's no longer offered in the
 * designer. Files stay while something still uses them (a placed design, an
 * order's files, a proof). Returns how many library entries went.
 */
export async function forgetArtwork(db: BusinessDb, owner: ArtOwner, fileId: string): Promise<number> {
  const file = await db.storedFile.findUnique({ where: { id: fileId }, select: { sha256: true } });
  if (!file) return 0;
  const or = ownerWhere(owner);
  const assets = await db.artworkAsset.findMany({ where: { OR: [{ fileId }, ...(or.length ? [{ file: { sha256: file.sha256 }, OR: or }] : [])] }, select: { id: true } });
  for (const a of assets) await removeFromLibrary(db, a.id);
  return assets.length;
}

/** Mark library artwork as just used, so it sorts first next time. */
export async function touchArtwork(tx: BusinessTx, fileId: string) {
  await tx.artworkAsset.updateMany({ where: { fileId }, data: { lastUsedAt: new Date() } });
}
