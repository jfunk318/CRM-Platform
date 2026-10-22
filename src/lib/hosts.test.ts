import { describe, expect, it } from "vitest";
import { isValidDomain, isValidSlug, normalizeHost, parseHost } from "./hosts";

describe("parseHost", () => {
  const P = "nametbd.com";
  it("recognizes the platform, business subdomains and custom domains", () => {
    expect(parseHost("nametbd.com", P)).toEqual({ kind: "platform" });
    expect(parseHost("www.NameTBD.com:443", P)).toEqual({ kind: "platform" });
    expect(parseHost("beezetees.nametbd.com", P)).toEqual({ kind: "slug", slug: "beezetees" });
    expect(parseHost("beezetees.com", P)).toEqual({ kind: "domain", domain: "beezetees.com" });
    expect(parseHost("www.beezetees.com", P)).toEqual({ kind: "domain", domain: "beezetees.com" });
  });
  it("handles local development", () => {
    expect(parseHost("localhost:3000", P)).toEqual({ kind: "local" });
    expect(parseHost("127.0.0.1:3000", null)).toEqual({ kind: "local" });
    expect(parseHost("beezetees.localhost:3000", null)).toEqual({ kind: "slug", slug: "beezetees" });
    expect(parseHost(null, P)).toEqual({ kind: "local" });
  });
  it("ignores localhost shortcuts in production", () => {
    expect(parseHost("localhost:3000", P, false)).toEqual({ kind: "domain", domain: "localhost" });
    expect(parseHost("beezetees.localhost", P, false)).toEqual({ kind: "domain", domain: "beezetees.localhost" });
  });
  it("treats any non-platform host as a custom domain when no platform domain is set", () => {
    expect(parseHost("beezetees.com", null)).toEqual({ kind: "domain", domain: "beezetees.com" });
  });
});

describe("validation", () => {
  it("normalizes hosts", () => expect(normalizeHost(" WWW.Beeze.com:8080 ")).toBe("beeze.com"));
  it("checks slugs", () => {
    expect(isValidSlug("beezetees")).toBe(true);
    expect(isValidSlug("beeze-tees2")).toBe(true);
    for (const s of ["-beeze", "beeze-", "Beeze", "beeze.tees", ""]) expect(isValidSlug(s)).toBe(false);
  });
  it("checks domains", () => {
    for (const d of ["beezetees.com", "rebrand.co", "shop.example.co.uk"]) expect(isValidDomain(d)).toBe(true);
    for (const d of ["https://beezetees.com", "beeze tees.com", "localhost", "-bad.com"]) expect(isValidDomain(d)).toBe(false);
  });
});
