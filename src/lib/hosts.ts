/** The platform's own domain, e.g. "nametbd.com". Unset in local development. */
export const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN?.trim().toLowerCase() || null;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** "WWW.CompanyName.com:443" → "companyname.com" */
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
  // <slug>.<platform> or <store>.<slug>.<platform> (same with .localhost)
  | { kind: "slug"; slug: string; store?: string }
  | { kind: "domain"; domain: string }
  | { kind: "local" };

/** "companyname" → slug; "store1.companyname" → store of slug; anything deeper isn't ours. */
function slugAndStore(labels: string): ParsedHost | null {
  const parts = labels.split(".");
  if (parts.length === 1) return { kind: "slug", slug: parts[0] };
  if (parts.length === 2) return { kind: "slug", slug: parts[1], store: parts[0] };
  return null;
}

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
    if (host.endsWith(".localhost")) return slugAndStore(host.slice(0, -".localhost".length)) ?? { kind: "domain", domain: host };
  }
  if (platformDomain) {
    if (host === platformDomain) return { kind: "platform" };
    if (host.endsWith(`.${platformDomain}`)) return slugAndStore(host.slice(0, -platformDomain.length - 1)) ?? { kind: "domain", domain: host };
  }
  return { kind: "domain", domain: host };
}

/** Valid business slugs: lowercase letters, digits and hyphens, one DNS label. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

/** Lowercase hostname check, e.g. "companyname.com" or "shop.example.co.uk". */
export function isValidDomain(domain: string): boolean {
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}
