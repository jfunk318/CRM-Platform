import "server-only";
import { Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { blankUnitPrice, PricingError } from "@/lib/pricing";

/** Lowest blank (undecorated) price per product with the default pricing group's markup. */
export async function blankFromPrices(db: BusinessDb, productIds: string[]): Promise<Map<string, Prisma.Decimal>> {
  const group = await db.pricingGroup.findFirst({ where: { isDefault: true }, include: { markupTiers: true } });
  const out = new Map<string, Prisma.Decimal>();
  if (!group || productIds.length === 0) return out;
  const costs = await db.productVariant.groupBy({ by: ["productId"], where: { productId: { in: productIds }, active: true }, _min: { wholesaleCost: true } });
  const tiers = group.markupTiers.map((t) => ({ costFrom: t.costFrom.toString(), costTo: t.costTo?.toString() ?? null, pct: t.pct.toString() }));
  for (const c of costs) {
    if (!c._min.wholesaleCost) continue;
    try {
      out.set(c.productId, new Prisma.Decimal(blankUnitPrice(c._min.wholesaleCost.toString(), tiers, group.markupMode).toFixed(2)));
    } catch (e) {
      if (!(e instanceof PricingError)) throw e;
    }
  }
  return out;
}
