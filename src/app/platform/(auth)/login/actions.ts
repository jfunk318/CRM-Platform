"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isPlatformRequest } from "@/lib/business";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createPlatformSession, destroyPlatformSession } from "@/lib/auth/platform-session";

export type LoginState = { error?: string; email?: string };

// Compared against when the email is unknown, so response time doesn't
// reveal which emails have accounts.
const dummyHash = hashPassword("not-a-real-password");

export async function platformLogin(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!(await isPlatformRequest())) return { error: "Not available here." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const user = await prisma.platformUser.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !user.active || !ok) return { error: "Email or password is incorrect.", email };

  await createPlatformSession(user.id);
  redirect("/platform");
}

export async function platformLogout(): Promise<void> {
  await destroyPlatformSession();
  redirect("/platform/login");
}
