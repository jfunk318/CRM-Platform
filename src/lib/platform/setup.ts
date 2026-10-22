import type { BusinessDb } from "../db";

// Starting statuses; editable in admin to match how staff divide the work.
export const DEFAULT_ORDER_STATUSES: {
  type: "QUOTE" | "ORDER";
  name: string;
  color: string;
  isDefault?: boolean;
  isClosed?: boolean;
  isConversion?: boolean;
}[] = [
  { type: "QUOTE", name: "Draft", color: "#9CA3AF", isDefault: true },
  { type: "QUOTE", name: "Sent", color: "#3B82F6" },
  { type: "QUOTE", name: "Approved", color: "#10B981" },
  { type: "QUOTE", name: "Declined", color: "#EF4444", isClosed: true },
  { type: "QUOTE", name: "Converted to order", color: "#6366F1", isClosed: true, isConversion: true },
  { type: "ORDER", name: "New", color: "#3B82F6", isDefault: true },
  { type: "ORDER", name: "Awaiting artwork", color: "#F59E0B" },
  { type: "ORDER", name: "Artwork approved", color: "#14B8A6" },
  { type: "ORDER", name: "Ordering blanks", color: "#8B5CF6" },
  { type: "ORDER", name: "In production", color: "#F97316" },
  { type: "ORDER", name: "Ready for pickup / shipping", color: "#22C55E" },
  { type: "ORDER", name: "Completed", color: "#6B7280", isClosed: true },
  { type: "ORDER", name: "Cancelled", color: "#EF4444", isClosed: true },
];

/**
 * What every new business starts with: quote/order statuses, an Apparel
 * product type and a Retail pricing group (flat 40% markup). Safe to run
 * again; it only fills in what's missing.
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
}
