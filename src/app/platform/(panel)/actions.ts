"use server";

import type { BusinessStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { forBusiness, prisma } from "@/lib/db";
import { requirePlatformUser } from "@/lib/auth/platform-session";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { type ActionResult, FormError, optionalText, runAction, text } from "@/lib/admin/form";
import { slugify } from "@/lib/catalog/products";
import { isValidDomain, isValidSlug, normalizeHost, PLATFORM_DOMAIN } from "@/lib/hosts";
import { setUpBusiness } from "@/lib/platform/setup";

// Subdomains the platform keeps for itself.
const RESERVED_SLUGS = new Set(["www", "admin", "platform", "api", "app", "mail", "static", "assets", "help", "support"]);

function slug(form: FormData, fallbackFrom: string): string {
  const s = slugify(optionalText(form, "slug") ?? fallbackFrom);
  if (!isValidSlug(s)) throw new FormError("Web address must be lowercase letters, numbers and hyphens");
  if (RESERVED_SLUGS.has(s)) throw new FormError(`"${s}" is reserved; pick another web address`);
  return s;
}

function customDomain(form: FormData): string | null {
  const raw = optionalText(form, "customDomain");
  if (!raw) return null;
  const d = normalizeHost(raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""));
  if (!isValidDomain(d)) throw new FormError("Custom domain must look like example.com");
  if (PLATFORM_DOMAIN && (d === PLATFORM_DOMAIN || d.endsWith(`.${PLATFORM_DOMAIN}`))) {
    throw new FormError("Custom domain can't be on the platform's own domain");
  }
  return d;
}

export async function createBusiness(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePlatformUser();
  let id = "";
  const result = await runAction(async () => {
    const name = text(form, "name", "Business name");
    const adminEmail = text(form, "adminEmail", "Admin email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new FormError("Enter a valid admin email");
    const adminPassword = String(form.get("adminPassword") ?? "");
    if (adminPassword.length < MIN_PASSWORD_LENGTH) {
      throw new FormError(`Admin password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const business = await prisma.business.create({
      data: { name, slug: slug(form, name), customDomain: customDomain(form) },
    });
    try {
      const db = forBusiness(business.id);
      await setUpBusiness(db);
      await db.staffUser.create({
        data: {
          businessId: business.id,
          email: adminEmail,
          name: optionalText(form, "adminName") ?? "Admin",
          roles: ["ADMIN"],
          passwordHash: await hashPassword(adminPassword),
        },
      });
    } catch (e) {
      // Don't leave a half-set-up business behind.
      await prisma.business.delete({ where: { id: business.id } });
      throw e;
    }
    id = business.id;
  });
  if (result.error) return result;
  revalidatePath("/platform");
  redirect(`/platform/businesses/${id}`);
}

export async function updateBusiness(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePlatformUser();
  return runAction(async () => {
    const id = text(form, "id");
    const name = text(form, "name", "Business name");
    const status = String(form.get("status")) as BusinessStatus;
    if (status !== "ACTIVE" && status !== "SUSPENDED") throw new FormError("Choose a status");
    await prisma.business.update({
      where: { id },
      data: { name, slug: slug(form, name), customDomain: customDomain(form), status },
    });
    revalidatePath(`/platform/businesses/${id}`);
    revalidatePath("/platform");
  });
}
