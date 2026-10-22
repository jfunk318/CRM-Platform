/** The platform's own domain, e.g. "nametbd.com". Unset in local development. */
export const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN?.trim().toLowerCase() || null;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** "WWW.BeezeTees.com:443" → "beezetees.com" */
export function normalizeHost(rawHost: string | null | undefined): string {
  return (rawHost ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export const isLocalHost = (host: string) => LOCAL_HOSTS.has(host);

export type ParsedHost =
  | { kind: "platform" }
  | { kind: "slug"; slug: string }
  | { kind: "domain"; domain: string }
  | { kind: "local" };

/** Classify a request host. Pure, so it can be unit tested. */
export function parseHost(
  rawHost: string | null | undefined,
  platformDomain = PLATFORM_DOMAIN,
  allowLocal = process.env.NODE_ENV !== "production",
): ParsedHost {
  const host = normalizeHost(rawHost);
  // localhost conveniences only exist in development.
  if (allowLocal) {
    if (!host || isLocalHost(host)) return { kind: "local" };
    if (host.endsWith(".localhost")) return { kind: "slug", slug: host.slice(0, -".localhost".length) };
  }
  if (platformDomain) {
    if (host === platformDomain) return { kind: "platform" };
    if (host.endsWith(`.${platformDomain}`)) return { kind: "slug", slug: host.slice(0, -platformDomain.length - 1) };
  }
  return { kind: "domain", domain: host };
}

/** Valid business slugs: lowercase letters, digits and hyphens, one DNS label. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

/** Lowercase hostname check, e.g. "beezetees.com" or "shop.example.co.uk". */
export function isValidDomain(domain: string): boolean {
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}
