// Webstore quotes: items without quantities, priced for the store later.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { addLine, convertQuote, createOrder } from "./service";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`forstore-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

describe("webstore quotes", () => {
  it("take items without quantities, which don't count toward the total and can't be converted", async () => {
    const quote = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    const noQty = { ...t.line(), quantities: {} };
    await expect(addLine(t.db, quote, noQty, null)).rejects.toThrow(/quantity/);

    await t.db.order.update({ where: { id: quote }, data: { forStore: true } });
    const lineId = await addLine(t.db, quote, noQty, null);
    const line = await t.db.orderLine.findUniqueOrThrow({ where: { id: lineId }, include: { sizes: true, order: true } });
    expect(line.sizes).toHaveLength(0);
    expect(line.issues).toEqual([]);
    expect(line.order.total.toNumber()).toBe(0);
    await expect(convertQuote(t.db, quote, null)).rejects.toThrow(/no quantities/);
  });
});
