import "server-only";
import type { Business } from "@prisma/client";
import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isLocalHost, normalizeHost, parseHost, PLATFORM_DOMAIN } from "./hosts";

export { isLocalHost, normalizeHost, PLATFORM_DOMAIN };

/**
 * Which business a host name belongs to:
 * - <slug>.<PLATFORM_DOMAIN> or <slug>.localhost → business by slug
 * - the business's own domain (customDomain) → that business
 * - localhost in development → DEV_BUSINESS_SLUG, or the only business
 */
export async function businessForHost(rawHost: string | null): Promise<Business | null> {
  const parsed = parseHost(rawHost);
  switch (parsed.kind) {
    case "platform":
      return null;
    case "slug":
      return prisma.business.findUnique({ where: { slug: parsed.slug } });
    case "domain":
      return prisma.business.findUnique({ where: { customDomain: parsed.domain } });
    case "local": {
      if (process.env.DEV_BUSINESS_SLUG) {
        return prisma.business.findUnique({ where: { slug: process.env.DEV_BUSINESS_SLUG } });
      }
      const active = await prisma.business.findMany({ where: { status: "ACTIVE" }, take: 2 });
      return active.length === 1 ? active[0] : null;
    }
  }
}

/**
 * The host the browser requested. Next.js renders redirects from server
 * actions through an internal request to its own host, keeping the original
 * in x-forwarded-host (as do hosting proxies), so that header wins. A client
 * could send its own, but it only picks which business the request is
 * about: sessions are tied to one business and browsers only send a
 * business's cookie to that business's real address.
 */
export const getRequestHost = cache(async () => {
  const h = await headers();
  return h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
});

/** The business this request is for (from its host name), or null. */
export const getRequestBusiness = cache(async () => businessForHost(await getRequestHost()));

/** Whether this request may use the platform admin area. */
export async function isPlatformRequest(): Promise<boolean> {
  const parsed = parseHost(await getRequestHost());
  return parsed.kind === "platform" || parsed.kind === "local";
}

/** The business's public address: its own domain, else its platform subdomain. */
export function businessDomain(b: Pick<Business, "slug" | "customDomain">): string {
  return b.customDomain ?? `${b.slug}.${PLATFORM_DOMAIN ?? "localhost"}`;
}

/** Address of one of a business's affiliate stores: <store>.<business domain> */
export function storeUrl(storeSlug: string, b: Pick<Business, "slug" | "customDomain">): string {
  return `https://${storeSlug}.${businessDomain(b)}`;
}
