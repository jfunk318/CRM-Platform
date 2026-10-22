import "server-only";
import type { DeliveryKind, Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { deliveryNote, isValidEmail, sendEmail } from "@/lib/email/mailer";
import { pickupReadyEmail, shipmentEmail } from "@/lib/email/templates";
import { customerLink, ensurePublicToken } from "@/lib/orders/customer-flow";
import { orderRef } from "@/lib/orders/numbers";
import { logEvent, moveToRole, OrderError } from "@/lib/orders/service";
import { carrierName, trackingUrl } from "./labels";

export { CARRIERS, carrierName, DELIVERY_KIND_LABELS, trackingUrl } from "./labels";

export const shippingOrderInclude = {
  customer: true,
  deliveryMethod: true,
  lines: {
    orderBy: { sortOrder: "asc" },
    include: { sizes: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } }, design: { include: { product: true, color: true } } },
  },
  shipments: { include: { items: true }, orderBy: { shippedAt: "asc" } },
} satisfies Prisma.OrderInclude;

type ShippingOrder = Prisma.OrderGetPayload<{ include: typeof shippingOrderInclude }>;

/** Every line and size with how many were ordered, sent and still to go. */
export function shipmentProgress(order: ShippingOrder) {
  const sent = new Map<string, number>();
  for (const sh of order.shipments) for (const i of sh.items) if (i.lineId) sent.set(`${i.lineId}:${i.sizeId}`, (sent.get(`${i.lineId}:${i.sizeId}`) ?? 0) + i.qty);
  const rows = order.lines.flatMap((l) =>
    l.sizes.map((s) => {
      const shipped = sent.get(`${l.id}:${s.sizeId}`) ?? 0;
      return {
        lineId: l.id,
        sizeId: s.sizeId,
        description: `${l.design.product.styleCode} ${l.design.product.name} · ${l.design.color.name} · ${s.size.code}`,
        ordered: s.qty,
        shipped,
        remaining: Math.max(0, s.qty - shipped),
      };
    }),
  );
  const total = rows.reduce((n, r) => n + r.ordered, 0);
  const remaining = rows.reduce((n, r) => n + r.remaining, 0);
  return { rows, total, remaining, complete: total > 0 && remaining === 0 };
}

const brandOf = (b: { name: string; email: string | null; phone: string | null }) => ({ name: b.name, email: b.email, phone: b.phone });

export type ShipmentInput = {
  kind: DeliveryKind;
  deliveryMethodId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  cost: string | null;
  note: string | null;
  items: { lineId: string; sizeId: string; qty: number }[];
  notify: boolean;
  origin: string;
};

/** Record a shipment, pickup or delivery of some or all of an order. */
export async function createShipment(db: BusinessDb, orderId: string, input: ShipmentInput, staffId: string | null) {
  const businessId = db.$businessId;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { ...shippingOrderInclude, status: true } });
  if (order.type !== "ORDER") throw new OrderError("Only orders can be shipped");
  const progress = shipmentProgress(order);
  const items = input.items.filter((i) => i.qty > 0);
  if (items.length === 0) throw new OrderError("Enter how many of each item are going");
  for (const i of items) {
    const row = progress.rows.find((r) => r.lineId === i.lineId && r.sizeId === i.sizeId);
    if (!row) throw new OrderError("That item isn't on this order");
    if (i.qty > row.remaining) throw new OrderError(`Only ${row.remaining} of ${row.description} left to send`);
  }
  const method = input.deliveryMethodId ? await db.deliveryMethod.findUniqueOrThrow({ where: { id: input.deliveryMethodId } }) : null;
  const kind = method?.kind ?? input.kind;
  const carrier = kind === "SHIP" ? (input.carrier ?? method?.carrier ?? null) : null;
  const trackingNumber = kind === "SHIP" ? input.trackingNumber : null;
  const describe = (i: (typeof items)[number]) => progress.rows.find((r) => r.lineId === i.lineId && r.sizeId === i.sizeId)!.description;

  const shipment = await db.$transaction(async (tx) => {
    const sh = await tx.shipment.create({
      data: {
        businessId,
        orderId,
        kind,
        deliveryMethodId: method?.id ?? null,
        methodName: method?.name ?? null,
        carrier,
        trackingNumber,
        cost: input.cost,
        note: input.note,
        createdById: staffId,
        items: { create: items.map((i) => ({ lineId: i.lineId, sizeId: i.sizeId, qty: i.qty, description: describe(i) })) },
      },
    });
    const pieces = items.reduce((n, i) => n + i.qty, 0);
    const how = kind === "PICKUP" ? "picked up" : kind === "DELIVERY" ? "delivered" : `shipped${carrier ? ` via ${carrierName(carrier)}` : ""}${trackingNumber ? ` (${trackingNumber})` : ""}`;
    await logEvent(tx, businessId, orderId, "SHIPMENT", `${pieces} piece${pieces === 1 ? "" : "s"} ${how}`, staffId);
    if (pieces === progress.remaining) await moveToRole(tx, businessId, orderId, "ORDER_FULFILLED", staffId, "everything has gone out", { forwardOnly: true });
    return sh;
  });

  let emailStatus: "SENT" | "FAILED" | "LOGGED" | null = null;
  if (input.notify && isValidEmail(order.customer.email)) {
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    const token = await ensurePublicToken(db, orderId);
    const content = shipmentEmail({
      brand: brandOf(business),
      customerName: order.customer.firstName,
      ref: orderRef(order),
      pickup: kind === "PICKUP",
      carrier: carrierName(carrier),
      trackingNumber,
      trackingUrl: trackingUrl(carrier, trackingNumber),
      items: items.map((i) => `${i.qty} × ${describe(i)}`),
      complete: items.reduce((n, i) => n + i.qty, 0) === progress.remaining,
      url: customerLink(input.origin, token),
    });
    const result = await sendEmail(db, { ...content, to: order.customer.email, fromName: business.name, replyTo: business.email, orderId });
    emailStatus = result.status;
    if (result.status === "SENT") await db.shipment.update({ where: { id: shipment.id }, data: { notifiedAt: new Date() } });
    await logEvent(db, businessId, orderId, "EMAIL", `Shipping notice emailed to ${order.customer.email}${deliveryNote(result.status)}`, staffId);
  }
  return { shipmentId: shipment.id, emailStatus };
}

/** Undo a shipment entered by mistake. */
export async function deleteShipment(db: BusinessDb, shipmentId: string, staffId: string | null) {
  const sh = await db.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { items: true } });
  await db.shipment.delete({ where: { id: shipmentId } });
  const pieces = sh.items.reduce((n, i) => n + i.qty, 0);
  await logEvent(db, db.$businessId, sh.orderId, "SHIPMENT", `Removed a shipment of ${pieces} piece${pieces === 1 ? "" : "s"}`, staffId);
}

/** Tell the customer their order is ready to collect. */
export async function notifyReadyForPickup(db: BusinessDb, orderId: string, origin: string, staffId: string | null) {
  const businessId = db.$businessId;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true } });
  if (!isValidEmail(order.customer.email)) throw new OrderError("Add an email address to the customer first");
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  const token = await ensurePublicToken(db, orderId);
  const address = [business.addressLine1, business.addressLine2, [business.city, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(
    (l): l is string => !!l,
  );
  const content = pickupReadyEmail({ brand: brandOf(business), customerName: order.customer.firstName, ref: orderRef(order), address, url: customerLink(origin, token) });
  const result = await sendEmail(db, { ...content, to: order.customer.email, fromName: business.name, replyTo: business.email, orderId });
  if (result.status === "SENT") await db.order.update({ where: { id: orderId }, data: { readyNotifiedAt: new Date() } });
  await logEvent(db, businessId, orderId, "EMAIL", `Ready-for-pickup notice emailed to ${order.customer.email}${deliveryNote(result.status)}`, staffId);
  return result.status;
}
