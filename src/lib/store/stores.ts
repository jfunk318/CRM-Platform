import "server-only";
import type { BusinessDb } from "@/lib/db";
import { slugify } from "@/lib/catalog/products";
import { isValidSlug } from "@/lib/hosts";

export class StoreError extends Error {}

// Subdomains the platform itself needs.
const RESERVED_SUBDOMAINS = new Set(["www", "admin", "api", "app", "mail", "shop", "store", "stores", "platform", "static", "media"]);

/** A free store address based on `name` ("tigers", "tigers-2", …). */
export async function freeStoreSlug(db: BusinessDb, name: string): Promise<string> {
  const base = slugify(name).slice(0, 40).replace(/-+$/, "") || "store";
  let slug = base;
  for (let n = 2; RESERVED_SUBDOMAINS.has(slug) || (await db.store.findFirst({ where: { slug } })); n++) slug = `${base}-${n}`;
  return slug;
}

/** Throws if `slug` can't be a store's address (`exceptId`: the store being renamed). */
export async function checkStoreSlug(db: BusinessDb, slug: string, exceptId?: string) {
  if (!isValidSlug(slug)) throw new StoreError("The address can use lowercase letters, numbers and hyphens");
  if (RESERVED_SUBDOMAINS.has(slug)) throw new StoreError(`"${slug}" is reserved; choose another address`);
  if (await db.store.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) } })) throw new StoreError(`${slug} is already taken`);
}

/** A new affiliate store with a home page. */
export async function createAffiliateStore(
  db: BusinessDb,
  o: { name: string; slug: string | null; groupId?: string | null; managerId?: string | null; customerId?: string | null },
) {
  const slug = (o.slug ?? slugify(o.name)).toLowerCase();
  await checkStoreSlug(db, slug);
  return db.store.create({
    data: {
      businessId: db.$businessId,
      kind: "AFFILIATE",
      name: o.name,
      slug,
      groupId: o.groupId ?? null,
      managerId: o.managerId ?? null,
      customerId: o.customerId ?? null,
      pages: { create: { slug: "home", title: "Home", body: `# ${o.name}\n\nWelcome to the ${o.name} store. Pick your gear below.` } },
    },
  });
}
