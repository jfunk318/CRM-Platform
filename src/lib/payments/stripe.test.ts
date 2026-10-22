import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { formEncode, verifyWebhook } from "./stripe";

const sign = (body: string, secret: string, t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("verifyWebhook", () => {
  const body = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  it("accepts a correct, recent signature", () => {
    expect(verifyWebhook(body, sign(body, "whsec_x", now), "whsec_x", now)).toBe(true);
  });
  it("rejects a wrong secret, a changed body, an old timestamp or no header", () => {
    expect(verifyWebhook(body, sign(body, "whsec_y", now), "whsec_x", now)).toBe(false);
    expect(verifyWebhook('{"id":"evt_2"}', sign(body, "whsec_x", now), "whsec_x", now)).toBe(false);
    expect(verifyWebhook(body, sign(body, "whsec_x", now - 1000), "whsec_x", now)).toBe(false);
    expect(verifyWebhook(body, null, "whsec_x", now)).toBe(false);
    expect(verifyWebhook(body, "t=abc,v1=zz", "whsec_x", now)).toBe(false);
  });
});

describe("formEncode", () => {
  it("encodes nested objects and arrays the way Stripe expects", () => {
    expect(formEncode({ mode: "payment", metadata: { cartId: "c 1" }, line_items: [{ quantity: 1, price_data: { unit_amount: 500 } }] }).join("&")).toBe(
      "mode=payment&metadata%5BcartId%5D=c%201&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=500",
    );
  });
});

describe("secret storage", () => {
  it("round-trips, uses a fresh IV each time, and detects tampering", () => {
    const a = encryptSecret("sk_test_123456789");
    const b = encryptSecret("sk_test_123456789");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("sk_test_123456789");
    const parts = a.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(parts.join("."))).toThrow();
    expect(maskSecret("sk_live_abcdefghijklmnop")).toBe("sk_live_…mnop");
  });
});
