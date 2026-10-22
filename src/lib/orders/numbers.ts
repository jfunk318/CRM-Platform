import type { OrderType, Prisma } from "@prisma/client";

/** Next sequential number for quotes or orders, safe under concurrent use. */
export async function nextOrderNumber(tx: Prisma.TransactionClient, type: OrderType): Promise<number> {
  const key = type === "QUOTE" ? "quote" : "order";
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" (key, value) VALUES (${key}, 1001)
    ON CONFLICT (key) DO UPDATE SET value = "Counter".value + 1
    RETURNING value`;
  return rows[0].value;
}

/** How a quote/order number is shown: quotes "Q-1001", orders "#1001". */
export function orderRef(order: { type: OrderType; number: number }): string {
  return order.type === "QUOTE" ? `Q-${order.number}` : `#${order.number}`;
}
