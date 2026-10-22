import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Business } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";

// Stripe through its REST API (no SDK): hosted Checkout for card payments,
// and signed webhooks to learn when a payment went through.

export class PaymentError extends Error {}

export type StripeKeys = { secretKey: string; webhookSecret: string | null };

export function stripeKeys(business: Pick<Business, "stripeSecretKeyEnc" | "stripeWebhookSecretEnc">): StripeKeys | null {
  if (!business.stripeSecretKeyEnc) return null;
  return {
    secretKey: decryptSecret(business.stripeSecretKeyEnc),
    webhookSecret: business.stripeWebhookSecretEnc ? decryptSecret(business.stripeWebhookSecretEnc) : null,
  };
}

/** Stripe's form encoding: nested keys as a[b][0][c]=v. */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => out.push(...(typeof item === "object" ? formEncode(item as Record<string, unknown>, `${key}[${i}]`) : [`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`])));
    else if (typeof v === "object") out.push(...formEncode(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

async function stripe<T>(keys: StripeKeys, method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${keys.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? formEncode(body).join("&") : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) throw new PaymentError(json.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

export type CheckoutSession = { id: string; url: string; payment_status: string; amount_total: number; payment_intent: string | null; metadata: Record<string, string> };

/** A hosted Stripe Checkout page for one amount. */
export function createCheckoutSession(
  keys: StripeKeys,
  o: { amountCents: number; currency: string; description: string; email?: string | null; successUrl: string; cancelUrl: string; metadata: Record<string, string>; idempotencyKey: string },
) {
  return stripe<CheckoutSession>(
    keys,
    "POST",
    "checkout/sessions",
    {
      mode: "payment",
      success_url: o.successUrl,
      cancel_url: o.cancelUrl,
      customer_email: o.email ?? undefined,
      client_reference_id: o.metadata.ref,
      metadata: o.metadata,
      payment_intent_data: { metadata: o.metadata, description: o.description },
      line_items: [{ quantity: 1, price_data: { currency: o.currency.toLowerCase(), unit_amount: o.amountCents, product_data: { name: o.description } } }],
    },
    o.idempotencyKey,
  );
}

export const retrieveCheckoutSession = (keys: StripeKeys, id: string) => stripe<CheckoutSession>(keys, "GET", `checkout/sessions/${encodeURIComponent(id)}`);

/** Check a key works (used when it's saved in settings). */
export const checkKey = (keys: StripeKeys) => stripe<{ id: string }>(keys, "GET", "balance").then(() => true);

/**
 * Verify a webhook's Stripe-Signature header (t=…,v1=…) against the raw body,
 * rejecting signatures older than `toleranceSec`.
 */
export function verifyWebhook(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || sigs.length === 0 || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
