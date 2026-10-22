"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { all, type ActionResult, checkbox, decimal, FormError, optionalText, runAction, text } from "@/lib/admin/form";
import {
  addLine,
  addNote,
  assign,
  convertQuote,
  type DecorationSpec,
  type LineSpec,
  OrderError,
  removeLine,
  setStatus,
  updateDetails,
  updateLine,
} from "@/lib/orders/service";

const refresh = (orderId: string) => revalidatePath(`/admin/orders/${orderId}`);

/** Order-service errors are user-facing, like form validation errors. */
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

function optionalNumber(raw: string | undefined, label: string, integer = false): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new FormError(`${label} must be a positive number`);
  if (integer && !Number.isInteger(n)) throw new FormError(`${label} must be a whole number`);
  return n;
}

function parseLine(form: FormData): LineSpec {
  const quantities: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("qty_")) continue;
    const qty = optionalNumber(String(value), "Quantity", true);
    if (qty) quantities[key.slice(4)] = qty;
  }
  const [methods, areas, locations, colors, stitches, widths, heights, inks, art, dig, reuse] = [
    "d_method", "d_area", "d_location", "d_colors", "d_stitches", "d_w", "d_h", "d_inks", "d_art", "d_dig", "d_reuse",
  ].map((n) => all(form, n));
  const decorations: DecorationSpec[] = methods.map((methodId, i) => {
    if (!methodId) throw new FormError(`Decoration ${i + 1}: choose a method`);
    return {
      methodId,
      areaId: areas[i] || null,
      location: locations[i] ?? "",
      colors: optionalNumber(colors[i], "Ink colors", true),
      stitches: optionalNumber(stitches[i], "Stitches", true),
      widthIn: optionalNumber(widths[i], "Width"),
      heightIn: optionalNumber(heights[i], "Height"),
      inkColors: (inks[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      needsArtwork: art[i] === "on",
      needsDigitizing: dig[i] === "on",
      reuseScreens: reuse[i] === "on",
    };
  });
  return {
    productId: text(form, "productId", "Product"),
    colorId: text(form, "colorId", "Color"),
    quantities,
    decorations,
    notes: optionalText(form, "notes"),
  };
}

export async function addLineAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  const orderId = text(form, "orderId");
  return run(async () => {
    await addLine(db, orderId, parseLine(form), staff.id);
    refresh(orderId);
    return "Item added";
  });
}

export async function updateLineAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  const orderId = text(form, "orderId");
  return run(async () => {
    await updateLine(db, text(form, "lineId"), parseLine(form), staff.id);
    refresh(orderId);
  });
}

export async function removeLineAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  const orderId = text(form, "orderId");
  return run(async () => {
    await removeLine(db, text(form, "lineId"), staff.id);
    refresh(orderId);
    return "Removed";
  });
}

export async function setStatusAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  // Anyone working an order (production, shipping…) can move its status.
  const staff = await requireStaff();
  const { db } = staff;
  const orderId = text(form, "orderId");
  return run(async () => {
    await setStatus(db, orderId, text(form, "statusId", "Status"), staff.id);
    refresh(orderId);
    return "Status updated";
  });
}

export async function assignAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const { db } = staff;
  const orderId = text(form, "orderId");
  return run(async () => {
    await assign(db, orderId, optionalText(form, "assignedToId"), staff.id);
    refresh(orderId);
    return "Assigned";
  });
}

export async function addNoteAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const { db } = staff;
  const orderId = text(form, "orderId");
  return run(async () => {
    await addNote(db, orderId, String(form.get("body") ?? ""), staff.id);
    refresh(orderId);
    return "Note added";
  });
}

export async function saveDetailsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  const orderId = text(form, "orderId");
  return run(async () => {
    const due = optionalText(form, "dueDate");
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new FormError("Due date must be a date");
    await updateDetails(db, 
      orderId,
      {
        title: optionalText(form, "title"),
        dueDate: due ? new Date(`${due}T00:00:00Z`) : null,
        rush: checkbox(form, "rush"),
        taxExempt: checkbox(form, "taxExempt"),
        pricingGroupId: optionalText(form, "pricingGroupId"),
        shipping: decimal(String(form.get("shipping") ?? "") || "0", "Shipping").toFixed(2),
        customerNotes: optionalText(form, "customerNotes"),
        ship: {
          name: optionalText(form, "shipName"),
          line1: optionalText(form, "shipLine1"),
          line2: optionalText(form, "shipLine2"),
          city: optionalText(form, "shipCity"),
          region: optionalText(form, "shipRegion"),
          postalCode: optionalText(form, "shipPostalCode"),
          country: optionalText(form, "shipCountry") ?? "US",
        },
      },
      staff.id,
    );
    refresh(orderId);
  });
}

export async function convertQuoteAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  const { db } = staff;
  let orderId = "";
  const result = await run(async () => {
    orderId = await convertQuote(db, text(form, "orderId"), staff.id);
  });
  if (result.error) return result;
  redirect(`/admin/orders/${orderId}`);
}
