import { describe, expect, it } from "vitest";
import { isValidDomain, storeUrl } from "./shop";

describe("isValidDomain", () => {
  it("accepts plain domains", () => {
    for (const d of ["beezetees.com", "rebrand.co", "shop.example.co.uk"]) expect(isValidDomain(d)).toBe(true);
  });
  it("rejects URLs, spaces and single labels", () => {
    for (const d of ["https://beezetees.com", "beeze tees.com", "localhost", "-bad.com", "beezetees.com/"]) {
      expect(isValidDomain(d)).toBe(false);
    }
  });
});

describe("storeUrl", () => {
  it("puts the store on a subdomain", () => {
    expect(storeUrl("lincoln-hockey", "rebrand.com")).toBe("https://lincoln-hockey.rebrand.com");
  });
});
