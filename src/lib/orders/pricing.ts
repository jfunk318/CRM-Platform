import "server-only";
import { Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { type LineItemPrice, priceLineItem, priceOrder, type PricingIssue } from "@/lib/pricing";
import { type DecorationRequest, LineRequestError, loadLineItemInput, loadTaxRates } from "@/lib/pricing/load";

const orderForPricing = {
  customer: { include: { company: true } },
  lines: {
    orderBy: { sortOrder: "asc" },
    include: {
      sizes: { include: { size: true } },
      names: true,
      design: { include: { decorations: { orderBy: { sortOrder: "asc" } }, product: true } },
    },
  },
} satisfies Prisma.OrderInclude;

type OrderForPricing = Prisma.OrderGetPayload<{ include: typeof orderForPricing }>;
type DesignDecorationRow = OrderForPricing["lines"][number]["design"]["decorations"][number];

/**
 * Lines whose decorations match (same method, placement, colors and size)
 * can share one quantity for the price break when the method allows it,
 * e.g. the same print on 12 navy and 12 black shirts prices as 24.
 */
function sameDesignKey(d: DesignDecorationRow): string {
  return [d.methodId, d.location.toLowerCase(), d.colors ?? "", d.stitches ?? "", d.widthIn ?? "", d.heightIn ?? ""].join("|");
}

function lineQty(line: OrderForPricing["lines"][number]): number {
  return line.sizes.reduce((n, s) => n + s.qty, 0);
}

/** Effective pricing group: order override, then customer, then company. */
export function pricingGroupFor(order: Pick<OrderForPricing, "pricingGroupId" | "customer">): string | null {
  return order.pricingGroupId ?? order.customer.pricingGroupId ?? order.customer.company?.pricingGroupId ?? null;
}

/**
 * Re-price a quote/order from current catalog data and save the snapshot:
 * unit prices per size, line fees and totals, and order totals with rush
 * and tax for the ship-to address. Pricing problems are stored as issues
 * on each line rather than failing the save.
 */
export async function repriceOrder(db: BusinessDb, orderId: string): Promise<void> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: orderForPricing });
  const combinable = await db.decorationMethod.findMany({ where: { combineSameDesignQty: true }, select: { id: true } });
  const combineIds = new Set(combinable.map((m) => m.id));

  const combinedQty = new Map<string, number>();
  for (const line of order.lines) {
    for (const d of line.design.decorations) {
      if (!combineIds.has(d.methodId)) continue;
      const key = sameDesignKey(d);
      combinedQty.set(key, (combinedQty.get(key) ?? 0) + lineQty(line));
    }
  }

  const pricingGroupId = pricingGroupFor(order);
  const priced: { lineId: string; price: LineItemPrice | null; issues: PricingIssue[] }[] = [];
  for (const line of order.lines) {
    if (line.fixedPrice) {
      priced.push({ lineId: line.id, price: fixedLinePrice(line), issues: [] });
      continue;
    }
    const decorations: DecorationRequest[] = line.design.decorations.map((d) => ({
      methodId: d.methodId,
      location: d.location,
      colors: d.colors ?? undefined,
      stitches: d.stitches ?? undefined,
      widthIn: d.widthIn?.toNumber(),
      heightIn: d.heightIn?.toNumber(),
      needsArtwork: d.needsArtwork,
      needsDigitizing: d.needsDigitizing,
      reuseScreens: d.reuseScreens,
      pricingQty: combineIds.has(d.methodId) ? combinedQty.get(sameDesignKey(d)) : undefined,
    }));
    try {
      const input = await loadLineItemInput(db, {
        productId: line.design.productId,
        colorId: line.design.colorId,
        quantities: Object.fromEntries(line.sizes.map((s) => [s.sizeId, s.qty])),
        decorations,
        pricingGroupId,
      });
      const price = priceLineItem(input);
      priced.push({ lineId: line.id, price, issues: price.issues });
    } catch (e) {
      if (!(e instanceof LineRequestError)) throw e;
      priced.push({ lineId: line.id, price: null, issues: [{ severity: "error", code: "LINE", message: e.message }] });
    }
  }

  shareScreenFees(order, priced, combineIds);

  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const taxExempt = order.taxExempt || (order.customer.taxExempt ?? order.customer.company?.taxExempt ?? false);
  const taxRates =
    taxExempt || !order.shipRegion
      ? []
      : await loadTaxRates(db, { country: order.shipCountry, region: order.shipRegion, postalCode: order.shipPostalCode });
  const totals = priceOrder({
    lines: priced.flatMap((p) => (p.price ? [p.price] : [])),
    shipping: order.shipping.toString(),
    rushFeePct: order.rush ? business.rushFeePct.toString() : 0,
    taxRates,
    discount: order.discount.toString(),
  });

  await db.$transaction(async (tx) => {
    for (const p of priced) {
      const line = order.lines.find((l) => l.id === p.lineId)!;
      for (const s of line.sizes) {
        const row = p.price?.sizes.find((r) => r.sizeCode === s.size.code);
        await tx.orderLineSize.update({
          where: { id: s.id },
          data: { unitPrice: row?.unitPrice.toFixed(2) ?? 0, total: row?.total.toFixed(2) ?? 0 },
        });
      }
      await tx.orderLine.update({
        where: { id: p.lineId },
        data: {
          decorationUnit: p.price?.decorations.reduce((acc, d) => acc.plus(d.unitPrice), new Prisma.Decimal(0)) ?? 0,
          discountPct: p.price?.sizes[0]?.discountPct.toString() ?? 0,
          fees: (p.price?.fees ?? []).map((f) => ({ ...f, amount: f.amount.toFixed(2) })),
          feesTotal: p.price?.feesTotal.toFixed(2) ?? 0,
          total: p.price?.total.toFixed(2) ?? 0,
          issues: p.issues.map((i) => ({ ...i })),
        },
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        merchandise: totals.merchandise.toFixed(2),
        feesTotal: Object.values(totals.fees)
          .reduce((a, b) => a.plus(b), new Prisma.Decimal(0))
          .toFixed(2),
        rushFee: totals.rushFee.toFixed(2),
        tax: totals.tax.toFixed(2),
        total: totals.total.toFixed(2),
        pricedAt: new Date(),
      },
    });
  });
}

/** A store purchase keeps the per-size prices it was sold at. */
function fixedLinePrice(line: OrderForPricing["lines"][number]): LineItemPrice {
  const zero = new Prisma.Decimal(0);
  const sizes = line.sizes.map((s) => ({
    sizeCode: s.size.code,
    qty: s.qty,
    blankUnit: zero,
    decorationUnit: zero,
    discountPct: zero,
    unitPrice: s.unitPrice,
    total: s.unitPrice.times(s.qty),
  }));
  // Names and numbers sold with the pieces add to the line's price.
  const merchandiseTotal = sizes.reduce((t, s) => t.plus(s.total), zero).plus(line.names.reduce((t, n) => t.plus(n.charge.times(n.qty)), zero));
  return {
    totalQty: sizes.reduce((n, s) => n + s.qty, 0),
    sizes,
    decorations: [],
    fees: [],
    merchandiseTotal,
    feesTotal: zero,
    total: merchandiseTotal,
    issues: [],
  };
}

/**
 * Screens are made once per design, so when lines share a combinable design
 * only one line pays the screen setup fee: the one needing the most screens
 * (e.g. the dark garment with a white underbase).
 */
function shareScreenFees(
  order: OrderForPricing,
  priced: { lineId: string; price: LineItemPrice | null }[],
  combineIds: Set<string>,
) {
  const holders = new Map<string, { price: LineItemPrice; feeIndex: number }[]>();
  for (const p of priced) {
    if (!p.price) continue;
    const line = order.lines.find((l) => l.id === p.lineId)!;
    p.price.fees.forEach((fee, feeIndex) => {
      if (fee.type !== "SCREEN_SETUP") return;
      const d = line.design.decorations.find((x) => x.location === fee.location && combineIds.has(x.methodId));
      if (!d) return;
      const key = sameDesignKey(d);
      holders.set(key, [...(holders.get(key) ?? []), { price: p.price!, feeIndex }]);
    });
  }
  for (const group of holders.values()) {
    if (group.length < 2) continue;
    const keep = group.reduce((a, b) => (b.price.fees[b.feeIndex].amount.gt(a.price.fees[a.feeIndex].amount) ? b : a));
    for (const h of group) {
      if (h === keep) continue;
      const fee = h.price.fees[h.feeIndex];
      h.price.feesTotal = h.price.feesTotal.minus(fee.amount);
      h.price.total = h.price.total.minus(fee.amount);
      h.price.fees[h.feeIndex] = { ...fee, amount: new Prisma.Decimal(0), description: `${fee.description} (shared with another item)` };
    }
  }
}
