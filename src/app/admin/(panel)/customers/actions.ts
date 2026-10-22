"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { all, type ActionResult, checkbox, FormError, optionalText, runAction, text } from "@/lib/admin/form";
import { diffRows } from "@/lib/catalog/products";
import { createOrder } from "@/lib/orders/service";

function email(form: FormData): string | null {
  const v = optionalText(form, "email")?.toLowerCase() ?? null;
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new FormError("Enter a valid email address");
  return v;
}

/** "inherit" | "yes" | "no" → null | true | false */
function triState(form: FormData, name: string): boolean | null {
  const v = String(form.get(name) ?? "inherit");
  return v === "yes" ? true : v === "no" ? false : null;
}

/** Existing company by id, or a new one from the typed name. */
async function companyId(form: FormData): Promise<string | null> {
  const newName = optionalText(form, "newCompany");
  if (newName) {
    const existing = await db.company.findFirst({ where: { name: { equals: newName, mode: "insensitive" } } });
    return existing?.id ?? (await db.company.create({ data: { name: newName } })).id;
  }
  return optionalText(form, "companyId");
}

export async function createCustomer(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  let id = "";
  const result = await runAction(async () => {
    const customer = await db.customer.create({
      data: {
        firstName: text(form, "firstName", "First name"),
        lastName: optionalText(form, "lastName") ?? "",
        email: email(form),
        phone: optionalText(form, "phone"),
        companyId: await companyId(form),
      },
    });
    id = customer.id;
  });
  if (result.error) return result;
  redirect(`/admin/customers/${id}`);
}

export async function saveCustomer(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const id = text(form, "id");
    await db.customer.update({
      where: { id },
      data: {
        firstName: text(form, "firstName", "First name"),
        lastName: optionalText(form, "lastName") ?? "",
        email: email(form),
        phone: optionalText(form, "phone"),
        notes: optionalText(form, "notes"),
        companyId: await companyId(form),
        pricingGroupId: optionalText(form, "pricingGroupId"),
        taxExempt: triState(form, "taxExempt"),
      },
    });
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
  });
}

export async function saveAddresses(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const customerId = text(form, "customerId");
    const cols = ["addressId", "label", "name", "line1", "line2", "city", "region", "postalCode", "country", "isDefault"];
    const [ids, labels, names, line1s, line2s, cities, regions, zips, countries, defaults] = cols.map((c) => all(form, c));
    const rows = names
      .map((name, i) => ({
        id: ids[i] || null,
        label: labels[i] || null,
        name,
        line1: line1s[i],
        line2: line2s[i] || null,
        city: cities[i],
        region: (regions[i] ?? "").toUpperCase(),
        postalCode: zips[i],
        country: (countries[i] || "US").toUpperCase(),
        isDefault: defaults[i] === "on",
      }))
      .filter((r) => [r.name, r.line1, r.city, r.region, r.postalCode].some(Boolean));
    rows.forEach((r, i) => {
      if (!r.name || !r.line1 || !r.city || !r.region || !r.postalCode) {
        throw new FormError(`Address ${i + 1}: name, street, city, state and ZIP are required`);
      }
    });
    if (rows.length && !rows.some((r) => r.isDefault)) rows[0].isDefault = true;
    if (rows.filter((r) => r.isDefault).length > 1) throw new FormError("Only one address can be the default");

    const existing = await db.address.findMany({ where: { customerId }, select: { id: true } });
    const d = diffRows(existing.map((a) => a.id), rows);
    await db.$transaction([
      db.address.deleteMany({ where: { id: { in: d.deleteIds } } }),
      ...d.update.map(({ id, ...data }) => db.address.update({ where: { id }, data })),
      ...d.create.map((data) => db.address.create({ data: { ...data, customerId } })),
    ]);
    revalidatePath(`/admin/customers/${customerId}`);
  });
}

export async function startOrder(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  let id = "";
  const result = await runAction(async () => {
    const type = form.get("type") === "ORDER" ? "ORDER" : "QUOTE";
    id = await createOrder({ type, customerId: text(form, "customerId"), staffId: staff.id, title: optionalText(form, "title") });
  });
  if (result.error) return result;
  redirect(`/admin/orders/${id}`);
}

export async function saveCompany(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["SALES"]);
  return runAction(async () => {
    const id = text(form, "id");
    await db.company.update({
      where: { id },
      data: {
        name: text(form, "name", "Name"),
        phone: optionalText(form, "phone"),
        website: optionalText(form, "website"),
        notes: optionalText(form, "notes"),
        pricingGroupId: optionalText(form, "pricingGroupId"),
        taxExempt: checkbox(form, "taxExempt"),
      },
    });
    revalidatePath(`/admin/companies/${id}`);
  });
}
