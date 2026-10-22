"use server";

import type { DeliveryKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/business";
import { type ActionResult, checkbox, FormError, optionalDecimal, optionalText, runAction, text } from "@/lib/admin/form";
import { OrderError } from "@/lib/orders/service";
import { createShipment, DELIVERY_KIND_LABELS, deleteShipment, notifyReadyForPickup } from "@/lib/shipping/service";

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OrderError) throw new FormError(e.message);
      throw e;
    }
  });
}

const refresh = (orderId?: string) => {
  revalidatePath("/admin/shipping");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
};

const kindOf = (v: string): DeliveryKind => {
  if (!(v in DELIVERY_KIND_LABELS)) throw new FormError("Choose how it's going out");
  return v as DeliveryKind;
};

export async function createShipmentAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SHIPPING"]);
  const orderId = text(form, "orderId");
  return run(async () => {
    const items: { lineId: string; sizeId: string; qty: number }[] = [];
    for (const [k, v] of form.entries()) {
      if (!k.startsWith("ship_") || String(v).trim() === "") continue;
      const qty = Number(String(v).trim());
      if (!Number.isInteger(qty) || qty < 0) throw new FormError("Quantities must be whole numbers");
      const [lineId, sizeId] = k.slice(5).split(":");
      items.push({ lineId, sizeId, qty });
    }
    const { emailStatus } = await createShipment(
      staff.db,
      orderId,
      {
        kind: kindOf(String(form.get("kind") ?? "SHIP")),
        deliveryMethodId: optionalText(form, "deliveryMethodId"),
        carrier: optionalText(form, "carrier")?.toLowerCase() ?? null,
        trackingNumber: optionalText(form, "trackingNumber"),
        cost: optionalDecimal(String(form.get("cost") ?? ""), "Postage cost")?.toFixed(2) ?? null,
        note: optionalText(form, "note"),
        items,
        notify: checkbox(form, "notify"),
        origin: await requestOrigin(),
      },
      staff.id,
    );
    refresh(orderId);
    if (emailStatus === "FAILED") return "Recorded, but the customer email failed; see the email log";
    if (emailStatus === "LOGGED") return "Recorded (email isn't set up, so the customer wasn't emailed)";
    return emailStatus ? "Recorded and the customer was emailed" : "Recorded";
  });
}

export async function deleteShipmentAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SHIPPING"]);
  return run(async () => {
    const sh = await staff.db.shipment.findUniqueOrThrow({ where: { id: text(form, "shipmentId") } });
    await deleteShipment(staff.db, sh.id, staff.id);
    refresh(sh.orderId);
    return "Removed";
  });
}

export async function notifyPickupAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SHIPPING"]);
  const orderId = text(form, "orderId");
  return run(async () => {
    const status = await notifyReadyForPickup(staff.db, orderId, await requestOrigin(), staff.id);
    refresh(orderId);
    if (status === "FAILED") throw new FormError("The email couldn't be sent; see the email log");
    return status === "LOGGED" ? "Recorded (email isn't set up, so nothing was sent)" : "Customer emailed";
  });
}

// ─── Delivery methods ───────────────────────────────────────────────────

export async function saveDeliveryMethod(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const id = optionalText(form, "id");
    const data = {
      name: text(form, "name", "Name"),
      kind: kindOf(String(form.get("kind") ?? "")),
      description: optionalText(form, "description"),
      price: optionalDecimal(String(form.get("price") ?? ""), "Price")?.toFixed(2) ?? "0",
      freeOver: optionalDecimal(String(form.get("freeOver") ?? ""), "Free over")?.toFixed(2) ?? null,
      carrier: optionalText(form, "carrier")?.toLowerCase() ?? null,
      service: optionalText(form, "service"),
      active: id ? checkbox(form, "active") : true,
      sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
    };
    if (id) await db.deliveryMethod.update({ where: { id }, data });
    else await db.deliveryMethod.create({ data: { ...data, businessId: db.$businessId, sortOrder: await db.deliveryMethod.count() } });
    revalidatePath("/admin/delivery-methods");
    return id ? "Saved" : `Added ${data.name}`;
  });
}

/** Delete a method; orders and shipments keep its name but lose the link. */
export async function deleteDeliveryMethod(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return runAction(async () => {
    const id = text(form, "id");
    await db.$transaction([
      db.order.updateMany({ where: { deliveryMethodId: id }, data: { deliveryMethodId: null } }),
      db.shipment.updateMany({ where: { deliveryMethodId: id }, data: { deliveryMethodId: null } }),
      db.deliveryMethod.delete({ where: { id } }),
    ]);
    revalidatePath("/admin/delivery-methods");
    return "Deleted";
  });
}
