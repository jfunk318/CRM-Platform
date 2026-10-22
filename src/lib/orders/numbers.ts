import type { OrderType } from "@prisma/client";
import type { BusinessTx } from "@/lib/db";

/**
 * Next sequential number for a business's quotes or orders, safe under
 * concurrent use. Raw SQL bypasses the scoped client, so businessId is
 * passed explicitly.
 */
export async function nextOrderNumber(tx: BusinessTx, businessId: string, type: OrderType): Promise<number> {
  const key = type === "QUOTE" ? "quote" : "order";
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("businessId", key, value) VALUES (${businessId}, ${key}, 1001)
    ON CONFLICT ("businessId", key) DO UPDATE SET value = "Counter".value + 1
    RETURNING value`;
  return rows[0].value;
}

/** How a quote/order number is shown: quotes "Q-1001", orders "#1001". */
export function orderRef(order: { type: OrderType; number: number }): string {
  return order.type === "QUOTE" ? `Q-${order.number}` : `#${order.number}`;
}
