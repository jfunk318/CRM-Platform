import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { isValidEmail, sendEmail } from "@/lib/email/mailer";
import { signInEmail } from "@/lib/email/templates";
import { OrderError } from "@/lib/orders/service";
import type { RequestStore } from "./resolve";

// Shopper accounts. A shopper is a Customer in the CRM; an account is a
// customer who has proved their email address with a one-time link. Passwords
// are optional on top of that.

export const SHOPPER_COOKIE = "shopper_session";

/** The owner portal; its sign-in works even in stores without shopper accounts. */
export const isOwnerPath = (next: string | null | undefined) => next === "/owner" || !!next?.startsWith("/owner?");
const SESSION_DAYS = 30;
const LINK_MINUTES = 30;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

async function startSession(rs: RequestStore, customerId: string) {
  const token = randomBytes(32).toString("base64url");
  await rs.db.customerSession.create({
    data: { businessId: rs.business.id, customerId, tokenHash: hash(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
  });
  await rs.db.customer.update({ where: { id: customerId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SHOPPER_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86_400 });
}

/** The signed-in shopper on this business's storefront, if any. */
export const getShopper = cache(async (rs: RequestStore) => {
  const token = (await cookies()).get(SHOPPER_COOKIE)?.value;
  if (!token) return null;
  const session = await rs.db.customerSession.findUnique({ where: { tokenHash: hash(token) }, include: { customer: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.customer;
});

export async function signOut(rs: RequestStore) {
  const jar = await cookies();
  const token = jar.get(SHOPPER_COOKIE)?.value;
  if (token) await rs.db.customerSession.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(SHOPPER_COOKIE);
}

/**
 * Email a one-time sign-in link. The same for new and returning shoppers, so
 * the response never reveals whether an email has an account.
 */
export async function sendSignInLink(rs: RequestStore, rawEmail: string, origin: string, next = "/account") {
  const email = rawEmail.trim().toLowerCase();
  if (!isValidEmail(email)) throw new OrderError("Enter a valid email address");
  const recent = await rs.db.customerToken.count({ where: { email, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
  if (recent >= 5) throw new OrderError("Too many sign-in links requested. Try again in an hour.");
  const token = randomBytes(32).toString("base64url");
  await rs.db.customerToken.create({
    data: { businessId: rs.business.id, email, tokenHash: hash(token), expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000) },
  });
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const url = `${origin}/account/link?token=${token}&next=${encodeURIComponent(safeNext)}`;
  const content = signInEmail({ brand: { name: rs.store.name, email: rs.business.email, phone: rs.business.phone }, url, minutes: LINK_MINUTES });
  const result = await sendEmail(rs.db, { ...content, to: email, fromName: rs.store.name, replyTo: rs.business.email });
  return result.status;
}

/** Use a sign-in link: finds (or creates) the customer for that email and signs them in. */
export async function redeemSignInLink(rs: RequestStore, token: string) {
  const row = await rs.db.customerToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new OrderError("That sign-in link has expired or was already used. Request a new one.");
  const used = await rs.db.customerToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count === 0) throw new OrderError("That sign-in link was already used. Request a new one.");
  const customer =
    (await rs.db.customer.findFirst({
      where: { email: { equals: row.email, mode: "insensitive" } },
      orderBy: [{ passwordHash: { sort: "desc", nulls: "last" } }, { emailVerifiedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    })) ?? (await rs.db.customer.create({ data: { businessId: rs.business.id, firstName: row.email.split("@")[0], email: row.email } }));
  await rs.db.customer.update({ where: { id: customer.id }, data: { emailVerifiedAt: customer.emailVerifiedAt ?? new Date() } });
  await startSession(rs, customer.id);
  return customer;
}

/** Email + password sign-in, for shoppers who've set a password. */
export async function passwordSignIn(rs: RequestStore, rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  const customer = await rs.db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" }, passwordHash: { not: null } } });
  // Same message either way, and a hash check even without an account, so
  // timing doesn't tell which emails have accounts.
  const ok = customer ? await verifyPassword(password, customer.passwordHash!) : (await verifyPassword(password, DUMMY_HASH), false);
  if (!customer || !ok) throw new OrderError("That email and password don't match. You can also sign in with an emailed link.");
  await startSession(rs, customer.id);
  return customer;
}

const DUMMY_HASH = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

export async function setShopperPassword(rs: RequestStore, customerId: string, password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new OrderError(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
  await rs.db.customer.update({ where: { id: customerId }, data: { passwordHash: await hashPassword(password) } });
}

export async function updateShopperProfile(rs: RequestStore, customerId: string, d: { firstName: string; lastName: string; phone: string | null }) {
  if (!d.firstName.trim()) throw new OrderError("Enter your first name");
  await rs.db.customer.update({ where: { id: customerId }, data: { firstName: d.firstName.trim().slice(0, 80), lastName: d.lastName.trim().slice(0, 80), phone: d.phone } });
}
