import "server-only";
import { cache } from "react";
import { forBusiness } from "@/lib/db";
import { getRequestBusiness } from "@/lib/business";
import { effectiveSettings } from "./settings";

/**
 * The store this request is for, from its host name. The business's own
 * address opens its root store; affiliate store subdomains come in phase 6.
 */
export const getRequestStore = cache(async () => {
  const business = await getRequestBusiness();
  if (!business || business.status !== "ACTIVE") return null;
  const db = forBusiness(business.id);
  const store = await db.store.findFirst({
    where: { kind: "ROOT", active: true },
    include: { deliveryMethods: true, logo: true },
  });
  if (!store) return null;
  return { business, db, store, settings: effectiveSettings(business, store) };
});

export type RequestStore = NonNullable<Awaited<ReturnType<typeof getRequestStore>>>;
