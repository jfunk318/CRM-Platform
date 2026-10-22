import type { OrderType } from "@prisma/client";
import type { BusinessTx } from "@/lib/db";

/**
 * Next number in a business's sequence ("quote", "order", "invoice"), safe
 * under concurrent use. Sequences start at 1001. Raw SQL bypasses the scoped
 * client, so businessId is passed explicitly.
 */
export async function nextNumber(tx: BusinessTx, businessId: string, key: "quote" | "order" | "invoice"): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("businessId", key, value) VALUES (${businessId}, ${key}, 1001)
    ON CONFLICT ("businessId", key) DO UPDATE SET value = "Counter".value + 1
    RETURNING value`;
  return rows[0].value;
}

export const nextOrderNumber = (tx: BusinessTx, businessId: string, type: OrderType) =>
  nextNumber(tx, businessId, type === "QUOTE" ? "quote" : "order");

/** How a quote/order number is shown: quotes "Q-1001", orders "#1001". */
export function orderRef(order: { type: OrderType; number: number }): string {
  return order.type === "QUOTE" ? `Q-${order.number}` : `#${order.number}`;
}

/** How an invoice number is shown: "INV-1001". */
export const invoiceRef = (invoiceNumber: number) => `INV-${invoiceNumber}`;
