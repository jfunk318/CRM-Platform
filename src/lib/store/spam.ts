import "server-only";
import { headers } from "next/headers";

// Light spam protection for public forms: a hidden field bots fill in, and a
// per-address limit on how often a form can be sent.

export const HONEYPOT_FIELD = "website";

const hits = new Map<string, number[]>();

/** True if this looks like a bot or the sender is going too fast. */
export async function looksLikeSpam(form: FormData, bucket: string, perHour = 10): Promise<boolean> {
  if (String(form.get(HONEYPOT_FIELD) ?? "").trim()) return true;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return recent.length > perHour;
}
