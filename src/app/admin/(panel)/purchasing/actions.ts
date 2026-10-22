"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { all, type ActionResult, checkbox, decimal, FormError, int, optionalText, runAction, text } from "@/lib/admin/form";
import { OrderError } from "@/lib/orders/service";
import { parseDay } from "@/lib/production/defaults";
import {
  addPoItem,
  cancelPurchaseOrder,
  createPurchaseOrder,
  markBlanksSupplied,
  orderBlanks,
  receivePurchaseOrder,
  releaseAllocation,
  removePoLine,
  sendPurchaseOrder,
  setStock,
  stopTracking,
  trackStock,
  updatePoLine,
  updatePurchaseOrder,
} from "@/lib/purchasing/service";

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

/** The purchasing pages (list and every PO), inventory, and any orders touched. */
function refresh(...paths: string[]) {
  revalidatePath("/admin/purchasing", "layout");
  for (const p of ["/admin/inventory", ...paths]) revalidatePath(p);
}

const orderPaths = (keys: string[]) => [...new Set(keys.map((k) => `/admin/orders/${k.split(":")[0]}`))];

export async function orderBlanksAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const keys = all(form, "key").filter(Boolean);
  return run(async () => {
    const r = await orderBlanks(staff.db, keys, { useStock: checkbox(form, "useStock"), staffId: staff.id });
    refresh(...orderPaths(keys));
    const parts = [
      ...(r.onOrder ? [`${r.onOrder} added to ${r.purchaseOrders} draft purchase order${r.purchaseOrders === 1 ? "" : "s"}`] : []),
      ...(r.fromStock ? [`${r.fromStock} taken from stock`] : []),
    ];
    return parts.join("; ");
  });
}

export async function markSuppliedAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const key = text(form, "key");
  return run(async () => {
    await markBlanksSupplied(staff.db, key, optionalText(form, "note"), staff.id);
    refresh(...orderPaths([key]));
    return "Marked as supplied";
  });
}

export async function releaseAllocationAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  return run(async () => {
    const a = await staff.db.blankAllocation.findUniqueOrThrow({ where: { id: text(form, "allocationId") } });
    await releaseAllocation(staff.db, a.id, staff.id);
    refresh(`/admin/orders/${a.orderId}`);
    return "Released";
  });
}

export async function createPoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  let id = "";
  const r = await run(async () => {
    id = await createPurchaseOrder(staff.db, text(form, "supplierId", "Supplier"), staff.id);
  });
  if (r.error) return r;
  redirect(`/admin/purchasing/${id}`);
}

export async function updatePoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "poId");
  return run(async () => {
    const expected = optionalText(form, "expectedAt");
    if (expected && !parseDay(expected)) throw new FormError("Expected date must be a date");
    await updatePurchaseOrder(staff.db, id, {
      shipToName: optionalText(form, "shipToName"),
      shipLine1: optionalText(form, "shipLine1"),
      shipLine2: optionalText(form, "shipLine2"),
      shipCity: optionalText(form, "shipCity"),
      shipRegion: optionalText(form, "shipRegion"),
      shipPostalCode: optionalText(form, "shipPostalCode"),
      shipCountry: (optionalText(form, "shipCountry") ?? "US").toUpperCase(),
      blindShip: checkbox(form, "blindShip"),
      notes: optionalText(form, "notes"),
      expectedAt: parseDay(expected),
    });
    refresh(`/admin/purchasing/${id}`);
  });
}

export async function addPoItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "poId");
  return run(async () => {
    await addPoItem(staff.db, id, text(form, "sku", "SKU"), int(String(form.get("qty") ?? ""), "Quantity"));
    refresh(`/admin/purchasing/${id}`);
    return "Added";
  });
}

export async function updatePoLineAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "poId");
  return run(async () => {
    await updatePoLine(staff.db, text(form, "lineId"), int(String(form.get("qty") ?? ""), "Quantity"), decimal(String(form.get("unitCost") ?? ""), "Cost"));
    refresh(`/admin/purchasing/${id}`);
  });
}

export async function removePoLineAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "poId");
  return run(async () => {
    await removePoLine(staff.db, text(form, "lineId"), staff.id);
    refresh(`/admin/purchasing/${id}`);
    return "Removed";
  });
}

export async function sendPoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "poId");
  const email = checkbox(form, "email");
  return run(async () => {
    const { status } = await sendPurchaseOrder(staff.db, id, { email, staffId: staff.id });
    refresh(`/admin/purchasing/${id}`);
    if (status === "FAILED") throw new FormError("The email couldn't be sent; see the email log below. The PO is still a draft.");
    if (status === "LOGGED") return "Marked sent (email isn't set up, so nothing was emailed; print it or send it yourself)";
    return email ? "Emailed to the supplier" : "Marked as sent";
  });
}

export async function receivePoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "poId");
  return run(async () => {
    const receipts: { lineId: string; qty: number }[] = [];
    for (const [k, v] of form.entries()) {
      if (!k.startsWith("recv_") || String(v).trim() === "") continue;
      const n = Number(String(v).trim());
      if (!Number.isInteger(n)) throw new FormError("Received quantities must be whole numbers");
      receipts.push({ lineId: k.slice(5), qty: n });
    }
    await receivePurchaseOrder(staff.db, id, receipts, staff.id);
    refresh(`/admin/purchasing/${id}`, "/admin/production");
    return "Received";
  });
}

export async function cancelPoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  const id = text(form, "poId");
  const r = await run(async () => {
    await cancelPurchaseOrder(staff.db, id, staff.id);
    refresh(`/admin/purchasing/${id}`);
  });
  if (r.error) return r;
  const still = await staff.db.purchaseOrder.findUnique({ where: { id } });
  if (!still) redirect("/admin/purchasing");
  return { ok: "Cancelled" };
}

// ─── Inventory ──────────────────────────────────────────────────────────

export async function trackStockAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  return run(async () => {
    const v = await trackStock(staff.db, text(form, "sku", "SKU"));
    refresh();
    return `Now tracking ${v.sku}`;
  });
}

export async function setStockAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  return run(async () => {
    const reorder = String(form.get("reorderPoint") ?? "").trim();
    await setStock(
      staff.db,
      text(form, "variantId"),
      int(String(form.get("onHand") ?? ""), "On hand"),
      reorder ? int(reorder, "Reorder at") : null,
      optionalText(form, "note"),
      staff.id,
    );
    refresh();
  });
}

export async function stopTrackingAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["PURCHASING"]);
  return run(async () => {
    await stopTracking(staff.db, text(form, "variantId"));
    refresh();
    return "Stopped tracking";
  });
}
