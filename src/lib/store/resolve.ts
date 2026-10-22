import "server-only";
import { cache } from "react";
import { forBusiness } from "@/lib/db";
import { getRequestBusiness, getRequestStoreSlug } from "@/lib/business";
import { effectiveSettings, storeStatus } from "./settings";

/**
 * The store this request is for, from its host name: an affiliate store on
 * its subdomain (store1.companyname.com), or the business's main site on
 * its own address.
 */
export const getRequestStore = cache(async () => {
  const business = await getRequestBusiness();
  if (!business || business.status !== "ACTIVE") return null;
  const db = forBusiness(business.id);
  const slug = await getRequestStoreSlug();
  const store = await db.store.findFirst({
    where: slug ? { kind: "AFFILIATE", slug } : { kind: "ROOT" },
    include: { deliveryMethods: true, logo: true, group: true },
  });
  // A switched-off store still resolves, so shoppers see that it's closed.
  if (!store) return null;
  return { business, db, store, settings: effectiveSettings(business, store, store.group), status: storeStatus(store) };
});

export type RequestStore = NonNullable<Awaited<ReturnType<typeof getRequestStore>>>;
