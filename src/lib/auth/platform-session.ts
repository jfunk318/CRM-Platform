import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isPlatformRequest } from "@/lib/business";
import { hashToken } from "./session";

// Separate from staff sessions: platform admins aren't staff of any business.
export const PLATFORM_COOKIE = "platform_session";
const SESSION_HOURS = 12;

export async function createPlatformSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await prisma.platformSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/platform",
    expires: expiresAt,
  });
}

export async function destroyPlatformSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PLATFORM_COOKIE)?.value;
  if (token) await prisma.platformSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete({ name: PLATFORM_COOKIE, path: "/platform" });
}

export const getCurrentPlatformUser = cache(async () => {
  if (!(await isPlatformRequest())) return null;
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.platformSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

/** Platform pages only exist on the platform's own domain (or localhost). */
export async function requirePlatformUser() {
  if (!(await isPlatformRequest())) notFound();
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/platform/login");
  return user;
}
