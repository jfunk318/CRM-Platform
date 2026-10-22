import type { StatusRole } from "@prisma/client";
import type { BusinessDb } from "../db";

// Starting statuses; editable in admin to match how staff divide the work.
export const DEFAULT_ORDER_STATUSES: {
  type: "QUOTE" | "ORDER";
  name: string;
  color: string;
  isDefault?: boolean;
  isClosed?: boolean;
  role?: StatusRole;
}[] = [
  { type: "QUOTE", name: "Draft", color: "#9CA3AF", isDefault: true },
  { type: "QUOTE", name: "Sent", color: "#3B82F6", role: "QUOTE_SENT" },
  { type: "QUOTE", name: "Changes requested", color: "#F59E0B", role: "QUOTE_CHANGES_REQUESTED" },
  { type: "QUOTE", name: "Approved", color: "#10B981", role: "QUOTE_APPROVED" },
  { type: "QUOTE", name: "Declined", color: "#EF4444", isClosed: true },
  { type: "QUOTE", name: "Converted to order", color: "#6366F1", isClosed: true, role: "QUOTE_CONVERTED" },
  { type: "ORDER", name: "New", color: "#3B82F6", isDefault: true },
  { type: "ORDER", name: "Awaiting artwork approval", color: "#F59E0B", role: "ORDER_PROOF_SENT" },
  { type: "ORDER", name: "Artwork changes requested", color: "#EF4444", role: "ORDER_CHANGES_REQUESTED" },
  { type: "ORDER", name: "Artwork approved", color: "#14B8A6", role: "ORDER_ARTWORK_APPROVED" },
  { type: "ORDER", name: "Ordering blanks", color: "#8B5CF6", role: "ORDER_BLANKS_ORDERED" },
  { type: "ORDER", name: "In production", color: "#F97316", role: "ORDER_IN_PRODUCTION" },
  { type: "ORDER", name: "Ready for pickup / shipping", color: "#22C55E", role: "ORDER_READY" },
  { type: "ORDER", name: "Completed", color: "#6B7280", isClosed: true, role: "ORDER_FULFILLED" },
  { type: "ORDER", name: "Cancelled", color: "#EF4444", isClosed: true },
];

/**
 * What every new business starts with: quote/order statuses, an Apparel
 * product type, a Retail pricing group (flat 40% markup) and two delivery
 * methods. Safe to run again; it only fills in what's missing.
 */
export async function setUpBusiness(db: BusinessDb): Promise<void> {
  const businessId = db.$businessId;
  for (const type of ["QUOTE", "ORDER"] as const) {
    if (await db.orderStatus.count({ where: { type } })) continue;
    await db.orderStatus.createMany({
      data: DEFAULT_ORDER_STATUSES.filter((s) => s.type === type).map((s, i) => ({ ...s, businessId, sortOrder: i })),
    });
  }
  await db.productType.upsert({
    where: { businessId_name: { businessId, name: "Apparel" } },
    update: {},
    create: { businessId, name: "Apparel", allowProcessMix: true },
  });
  if (!(await db.pricingGroup.count())) {
    await db.pricingGroup.create({
      data: {
        businessId,
        name: "Retail",
        isDefault: true,
        markupMode: "MARKUP",
        markupTiers: { create: [{ costFrom: 0, costTo: null, pct: 0.4 }] },
      },
    });
  }
  if (!(await db.deliveryMethod.count())) {
    await db.deliveryMethod.createMany({
      data: [
        { businessId, name: "Pickup at our shop", kind: "PICKUP", sortOrder: 0 },
        { businessId, name: "Ship to you", kind: "SHIP", sortOrder: 1 },
      ],
    });
  }
}
