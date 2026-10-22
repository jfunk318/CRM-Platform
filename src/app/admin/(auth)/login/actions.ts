"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createStaffSession, destroyStaffSession } from "@/lib/auth/session";

export type LoginState = { error?: string; email?: string };

// Compared against when the email is unknown, so response time doesn't
// reveal which emails have accounts.
const dummyHash = hashPassword("not-a-real-password");

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const user = await db.staffUser.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !user.active || !user.passwordHash || !ok) {
    return { error: "Email or password is incorrect.", email };
  }

  await createStaffSession(user.id);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroyStaffSession();
  redirect("/admin/login");
}
