import { type CommissionKind, Prisma } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";

const ZERO = new Prisma.Decimal(0);

/**
 * The store owner's commission on an order: a percentage of what was sold
 * after discounts (not tax or shipping), or an amount per piece.
 */
export function commissionFor(
  store: { commissionKind: CommissionKind | null; commissionValue: Prisma.Decimal | null },
  o: { merchandise: Prisma.Decimal; discount: Prisma.Decimal; pieces: number },
): Prisma.Decimal {
  if (!store.commissionKind || !store.commissionValue || store.commissionValue.lte(0)) return ZERO;
  if (store.commissionKind === "PER_PIECE") return store.commissionValue.times(o.pieces).toDecimalPlaces(2);
  const sold = Prisma.Decimal.max(o.merchandise.minus(o.discount), 0);
  return sold.times(store.commissionValue).dividedBy(100).toDecimalPlaces(2);
}

export const commissionLabel = (s: { commissionKind: CommissionKind | null; commissionValue: Prisma.Decimal | null }) =>
  !s.commissionKind || !s.commissionValue ? "None" : s.commissionKind === "PERCENT" ? `${s.commissionValue.toString()}% of sales` : `$${s.commissionValue.toFixed(2)} per piece`;

/** A store's orders that count toward commission: placed by shoppers, not cancelled. */
const commissionOrders = (storeId: string) =>
  ({
    storeId,
    type: "ORDER",
    source: "STOREFRONT",
    commission: { gt: 0 },
    // Cancelled = closed without being completed.
    NOT: { status: { isClosed: true, OR: [{ role: null }, { role: { not: "ORDER_FULFILLED" } }] } },
  }) satisfies Prisma.OrderWhereInput;

/**
 * Commission is earned once an order is paid in full; until then it's
 * pending. Owed = earned − paid out.
 */
export async function commissionSummary(db: BusinessDb | BusinessTx, storeId: string) {
  const [orders, payouts] = await Promise.all([
    db.order.findMany({ where: commissionOrders(storeId), select: { id: true, type: true, number: true, placedAt: true, total: true, paidTotal: true, commission: true, customer: { select: { firstName: true, lastName: true } } }, orderBy: { placedAt: "desc" } }),
    db.commissionPayout.findMany({ where: { storeId }, orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }], include: { createdBy: { select: { name: true } } } }),
  ]);
  const rows = orders.map((o) => ({ ...o, earned: o.paidTotal.gte(o.total) }));
  const earned = rows.filter((o) => o.earned).reduce((t, o) => t.plus(o.commission), ZERO);
  const pending = rows.filter((o) => !o.earned).reduce((t, o) => t.plus(o.commission), ZERO);
  const paidOut = payouts.reduce((t, p) => t.plus(p.amount), ZERO);
  return { orders: rows, payouts, earned, pending, paidOut, owed: earned.minus(paidOut) };
}
