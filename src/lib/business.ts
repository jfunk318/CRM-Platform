import "server-only";
import type { Business } from "@prisma/client";
import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isLocalHost, normalizeHost, parseHost, PLATFORM_DOMAIN } from "./hosts";

export { isLocalHost, normalizeHost, PLATFORM_DOMAIN };

export type HostTarget = { business: Business | null; store: string | null };

/**
 * Which business (and which of its affiliate stores) a host name is for:
 * - <slug>.<PLATFORM_DOMAIN> or <slug>.localhost → business by slug
 * - <store>.<slug>.<PLATFORM_DOMAIN> or <store>.<slug>.localhost → its store
 * - the business's own domain (customDomain) → that business
 * - <store>.<customDomain> → its store
 * - localhost in development → DEV_BUSINESS_SLUG, or the only business
 */
export async function hostTarget(rawHost: string | null): Promise<HostTarget> {
  const parsed = parseHost(rawHost);
  switch (parsed.kind) {
    case "platform":
      return { business: null, store: null };
    case "slug":
      return { business: await prisma.business.findUnique({ where: { slug: parsed.slug } }), store: parsed.store ?? null };
    case "domain": {
      const own = await prisma.business.findUnique({ where: { customDomain: parsed.domain } });
      if (own) return { business: own, store: null };
      const dot = parsed.domain.indexOf(".");
      const parent = dot > 0 ? await prisma.business.findUnique({ where: { customDomain: parsed.domain.slice(dot + 1) } }) : null;
      return parent ? { business: parent, store: parsed.domain.slice(0, dot) } : { business: null, store: null };
    }
    case "local": {
      if (process.env.DEV_BUSINESS_SLUG) {
        return { business: await prisma.business.findUnique({ where: { slug: process.env.DEV_BUSINESS_SLUG } }), store: null };
      }
      const active = await prisma.business.findMany({ where: { status: "ACTIVE" }, take: 2 });
      return { business: active.length === 1 ? active[0] : null, store: null };
    }
  }
}

export const businessForHost = async (rawHost: string | null) => (await hostTarget(rawHost)).business;

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

const getRequestTarget = cache(async () => hostTarget(await getRequestHost()));

/** The business this request is for (from its host name), or null. */
export const getRequestBusiness = cache(async () => (await getRequestTarget()).business);

/** The affiliate store subdomain this request came in on ("store1"), or null for the business's own address. */
export const getRequestStoreSlug = cache(async () => (await getRequestTarget()).store);

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

/**
 * The same, for the address this request came in on, so links work in
 * development too (http://store1.companyname.localhost:3000).
 */
export async function storeUrlHere(storeSlug: string | null): Promise<string> {
  const origin = await requestOrigin();
  if (!storeSlug) return origin;
  const [proto, rest] = origin.split("://");
  return `${proto}://${storeSlug}.${rest}`;
}

/**
 * Base URL of the address this request came in on, for links in emails
 * (e.g. https://companyname.com or http://companyname.localhost:3000).
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = (await getRequestHost()) ?? "localhost";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (parseHost(host).kind === "local" || host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
