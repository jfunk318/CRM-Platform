import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { StaffRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { hasAnyRole } from "./roles";

export const SESSION_COOKIE = "beeze_staff";
const SESSION_DAYS = 14;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createStaffSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.staffSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyStaffSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.staffSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentStaff = { id: string; email: string; name: string; roles: StaffRole[] };

/** The signed-in staff member for this request, or null. */
export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.staffSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { id, email, name, roles } = session.user;
  return { id, email, name, roles };
});

/**
 * Require a signed-in staff member (and optionally one of `roles`).
 * Redirects to login when signed out, or to the admin home when the role is missing.
 */
export async function requireStaff(roles: StaffRole[] = []): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/admin/login");
  if (!hasAnyRole(staff.roles, roles)) redirect("/admin?denied=1");
  return staff;
}
