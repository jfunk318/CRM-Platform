import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Brand and domain come from shop settings (Shop & tax in admin) so a
 * rebrand is a settings change, not a code change.
 */
export const getShop = cache(async () => {
  const s = await db.shopSettings.findUnique({ where: { id: 1 } });
  return { name: s?.shopName ?? "Beeze Tees", primaryDomain: s?.primaryDomain ?? "beezetees.com" };
});

/** Lowercase hostname check, e.g. "beezetees.com" or "shop.example.co.uk". */
export function isValidDomain(domain: string): boolean {
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}

/** Public address of an affiliate store: https://<slug>.<primaryDomain> */
export function storeUrl(slug: string, primaryDomain: string): string {
  return `https://${slug}.${primaryDomain}`;
}
