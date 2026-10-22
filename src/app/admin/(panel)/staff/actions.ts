"use server";

import type { StaffRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { ALL_ROLES } from "@/lib/auth/roles";
import { type ActionResult, checkbox, FormError, optionalText, runAction, text } from "@/lib/admin/form";

function roles(form: FormData): StaffRole[] {
  return ALL_ROLES.filter((r) => checkbox(form, `role_${r}`));
}

function checkPassword(pw: string) {
  if (pw.length < MIN_PASSWORD_LENGTH) throw new FormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
}

function email(form: FormData) {
  const v = text(form, "email", "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new FormError("Enter a valid email address");
  return v;
}

export async function createStaff(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const password = String(form.get("password") ?? "");
    checkPassword(password);
    const r = roles(form);
    if (r.length === 0) throw new FormError("Give the new staff member at least one role");
    const name = text(form, "name", "Name");
    await db.staffUser.create({ data: { name, email: email(form), roles: r, passwordHash: await hashPassword(password) } });
    revalidatePath("/admin/staff");
    return `Added ${name}`;
  });
}

export async function saveStaff(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const id = text(form, "id");
    const newRoles = roles(form);
    const active = checkbox(form, "active");
    const newPassword = optionalText(form, "password");
    if (newPassword) checkPassword(newPassword);

    if (id === me.id && (!active || !newRoles.includes("ADMIN"))) {
      throw new FormError("You can't remove your own admin access or deactivate yourself");
    }
    if (!active || !newRoles.includes("ADMIN")) {
      const otherAdmins = await db.staffUser.count({ where: { id: { not: id }, active: true, roles: { has: "ADMIN" } } });
      if (otherAdmins === 0) throw new FormError("There must always be at least one active admin");
    }

    await db.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id },
        data: {
          name: text(form, "name", "Name"),
          email: email(form),
          roles: newRoles,
          active,
          ...(newPassword && { passwordHash: await hashPassword(newPassword) }),
        },
      });
      // Deactivating or resetting a password signs them out everywhere.
      if (!active || newPassword) await tx.staffSession.deleteMany({ where: { userId: id } });
    });
    revalidatePath("/admin/staff");
    return newPassword ? "Saved; password reset and signed out of other sessions" : "Saved";
  });
}

export async function changeMyPassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  return runAction(async () => {
    const user = await db.staffUser.findUniqueOrThrow({ where: { id: me.id } });
    const current = String(form.get("current") ?? "");
    const next = String(form.get("next") ?? "");
    if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
      throw new FormError("Current password is incorrect");
    }
    checkPassword(next);
    if (next !== String(form.get("confirm") ?? "")) throw new FormError("New passwords don't match");
    await db.staffUser.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
    return "Password changed";
  });
}
