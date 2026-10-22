import { describe, expect, it } from "vitest";
import { isValidDomain, isValidSlug, normalizeHost, parseHost } from "./hosts";

describe("parseHost", () => {
  const P = "nametbd.com";
  it("recognizes the platform, business subdomains and custom domains", () => {
    expect(parseHost("nametbd.com", P)).toEqual({ kind: "platform" });
    expect(parseHost("www.NameTBD.com:443", P)).toEqual({ kind: "platform" });
    expect(parseHost("companyname.nametbd.com", P)).toEqual({ kind: "slug", slug: "companyname" });
    expect(parseHost("companyname.com", P)).toEqual({ kind: "domain", domain: "companyname.com" });
    expect(parseHost("www.companyname.com", P)).toEqual({ kind: "domain", domain: "companyname.com" });
  });
  it("handles local development", () => {
    expect(parseHost("localhost:3000", P)).toEqual({ kind: "local" });
    expect(parseHost("127.0.0.1:3000", null)).toEqual({ kind: "local" });
    expect(parseHost("companyname.localhost:3000", null)).toEqual({ kind: "slug", slug: "companyname" });
    expect(parseHost(null, P)).toEqual({ kind: "local" });
  });
  it("ignores localhost shortcuts in production", () => {
    expect(parseHost("localhost:3000", P, false)).toEqual({ kind: "domain", domain: "localhost" });
    expect(parseHost("companyname.localhost", P, false)).toEqual({ kind: "domain", domain: "companyname.localhost" });
  });
  it("treats any non-platform host as a custom domain when no platform domain is set", () => {
    expect(parseHost("companyname.com", null)).toEqual({ kind: "domain", domain: "companyname.com" });
  });
});

describe("validation", () => {
  it("normalizes hosts", () => expect(normalizeHost(" WWW.Company.com:8080 ")).toBe("company.com"));
  it("checks slugs", () => {
    expect(isValidSlug("companyname")).toBe(true);
    expect(isValidSlug("company-name2")).toBe(true);
    for (const s of ["-company", "company-", "Company", "company.name", ""]) expect(isValidSlug(s)).toBe(false);
  });
  it("checks domains", () => {
    for (const d of ["companyname.com", "rebrand.co", "shop.example.co.uk"]) expect(isValidDomain(d)).toBe(true);
    for (const d of ["https://companyname.com", "company name.com", "localhost", "-bad.com"]) expect(isValidDomain(d)).toBe(false);
  });
});
