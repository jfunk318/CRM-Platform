import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { hasAnyRole } from "./roles";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("hasAnyRole", () => {
  it("lets admins do everything", () => {
    expect(hasAnyRole(["ADMIN"], ["SHIPPING"])).toBe(true);
  });
  it("requires one of the listed roles", () => {
    expect(hasAnyRole(["SALES"], ["SALES", "PURCHASING"])).toBe(true);
    expect(hasAnyRole(["SHIPPING"], ["SALES"])).toBe(false);
    expect(hasAnyRole(["SHIPPING"], [])).toBe(true);
  });
});
