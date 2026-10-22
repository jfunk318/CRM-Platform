"use server";

import type { OrderType, StatusRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { all, type ActionResult, FormError, runAction, text } from "@/lib/admin/form";
import { diffRows } from "@/lib/catalog/products";
import { isStatusRole, STATUS_ROLES } from "@/lib/orders/status-roles";

export async function saveStatuses(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const type = text(form, "type") as OrderType;
    if (type !== "QUOTE" && type !== "ORDER") throw new FormError("Unknown type");
    const [ids, names, colors, defaults, closed, roles] = ["statusId", "name", "color", "isDefault", "isClosed", "role"].map((n) => all(form, n));
    const rows = names
      .map((name, i) => ({
        id: ids[i] || null,
        type,
        name,
        color: colors[i] || "#9CA3AF",
        isDefault: defaults[i] === "on",
        isClosed: closed[i] === "on" || roles[i] === "QUOTE_CONVERTED",
        role: roles[i] && isStatusRole(roles[i]) && STATUS_ROLES[roles[i] as StatusRole].type === type ? (roles[i] as StatusRole) : null,
        sortOrder: i,
      }))
      .filter((r) => r.name);

    if (rows.length === 0) throw new FormError("Keep at least one status");
    if (rows.filter((r) => r.isDefault).length !== 1) throw new FormError("Mark exactly one status as the starting status");
    if (rows.find((r) => r.isDefault)!.isClosed) throw new FormError("The starting status can't be a closed status");
    const tagged = rows.flatMap((r) => (r.role ? [r.role] : []));
    const dupRole = tagged.find((role, i) => tagged.indexOf(role) !== i);
    if (dupRole) throw new FormError(`Only one status can be set "${STATUS_ROLES[dupRole].label.toLowerCase()}"`);
    if (type === "QUOTE" && !tagged.includes("QUOTE_CONVERTED")) {
      throw new FormError("One quote status must be set \"when it becomes an order\"");
    }
    if (rows.some((r) => !/^#[0-9a-fA-F]{6}$/.test(r.color))) throw new FormError("Colors must look like #22C55E");
    if (new Set(rows.map((r) => r.name.toLowerCase())).size !== rows.length) throw new FormError("Two statuses have the same name");

    const existing = await db.orderStatus.findMany({ where: { type }, include: { _count: { select: { orders: true } } } });
    const d = diffRows(existing.map((s) => s.id), rows);
    const inUse = existing.filter((s) => d.deleteIds.includes(s.id) && s._count.orders > 0);
    if (inUse.length) {
      throw new FormError(`"${inUse[0].name}" is used by ${inUse[0]._count.orders} ${type === "QUOTE" ? "quote" : "order"}(s); move them to another status first`);
    }

    await db.$transaction(async (tx) => {
      await tx.orderStatus.deleteMany({ where: { id: { in: d.deleteIds } } });
      // Temporary names and no roles first, so swaps between rows don't collide.
      for (const r of d.update) await tx.orderStatus.update({ where: { id: r.id }, data: { name: `~${r.id}`, role: null } });
      for (const { id, ...data } of d.update) await tx.orderStatus.update({ where: { id }, data });
      for (const data of d.create) await tx.orderStatus.create({ data: { ...data, businessId: db.$businessId } });
    });
    revalidatePath("/admin/order-statuses");
  });
}
