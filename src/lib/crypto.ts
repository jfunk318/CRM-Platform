import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts secrets kept in the database (e.g. a business's Stripe keys) with
 * a key derived from APP_SECRET. Production refuses to run without it.
 */
function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set to store payment keys");
    return createHash("sha256").update("development-only-app-secret").digest();
  }
  return createHash("sha256").update(secret).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable stored secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** "sk_live_…abcd": enough to recognise a key without showing it. */
export const maskSecret = (plain: string) => (plain.length > 12 ? `${plain.slice(0, 8)}…${plain.slice(-4)}` : "••••");
