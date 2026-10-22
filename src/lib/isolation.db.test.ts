// Business isolation: one business must never see or change another's data,
// through the scoped client (app layer) or by linking records (database layer).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forBusiness, prisma } from "@/lib/db";

const tag = `iso-${Date.now()}`;
let a: ReturnType<typeof forBusiness>;
let b: ReturnType<typeof forBusiness>;
const ids = {} as Record<string, string>;

beforeAll(async () => {
  const [ba, bb] = await Promise.all([
    prisma.business.create({ data: { slug: `${tag}-a`, name: "Shop A" } }),
    prisma.business.create({ data: { slug: `${tag}-b`, name: "Shop B" } }),
  ]);
  ids.a = ba.id;
  ids.b = bb.id;
  a = forBusiness(ba.id);
  b = forBusiness(bb.id);
  const customerA = await a.customer.create({ data: { businessId: ba.id, firstName: "Alice" } });
  const supplierA = await a.supplier.create({ data: { businessId: ba.id, code: "sanmar", name: "SanMar" } });
  ids.customerA = customerA.id;
  ids.supplierA = supplierA.id;
});

afterAll(async () => {
  await prisma.business.deleteMany({ where: { id: { in: [ids.a, ids.b] } } });
  await prisma.$disconnect();
});

describe("scoped client", () => {
  it("only lists the business's own records", async () => {
    expect(await a.customer.count()).toBe(1);
    expect(await b.customer.count()).toBe(0);
    expect(await b.customer.findMany({ where: { businessId: ids.a } })).toEqual([]);
  });

  it("can't read another business's record by id", async () => {
    expect(await b.customer.findUnique({ where: { id: ids.customerA } })).toBeNull();
    expect(await b.customer.findFirst({ where: { id: ids.customerA } })).toBeNull();
  });

  it("can't update or delete another business's record", async () => {
    await expect(b.customer.update({ where: { id: ids.customerA }, data: { firstName: "Mallory" } })).rejects.toThrow();
    expect((await b.customer.updateMany({ where: { id: ids.customerA }, data: { firstName: "Mallory" } })).count).toBe(0);
    expect((await b.customer.deleteMany({ where: { id: ids.customerA } })).count).toBe(0);
    expect((await a.customer.findUniqueOrThrow({ where: { id: ids.customerA } })).firstName).toBe("Alice");
  });

  it("stamps creates with its own business even if told otherwise", async () => {
    const c = await b.customer.create({ data: { businessId: ids.a, firstName: "Bob" } });
    expect(c.businessId).toBe(ids.b);
    const many = await b.supplier.createManyAndReturn({ data: [{ businessId: ids.a, code: "ss", name: "S&S" }] });
    expect(many[0].businessId).toBe(ids.b);
  });

  it("keeps the scope inside transactions", async () => {
    await b.$transaction(async (tx) => {
      expect(await tx.customer.findUnique({ where: { id: ids.customerA } })).toBeNull();
      const s = await tx.supplier.create({ data: { businessId: ids.a, code: "pennant", name: "Pennant" } });
      expect(s.businessId).toBe(ids.b);
    });
  });

  it("lets two businesses use the same codes and names", async () => {
    const s = await b.supplier.create({ data: { businessId: ids.b, code: "sanmar", name: "SanMar" } });
    expect(s.code).toBe("sanmar");
  });
});

describe("database", () => {
  it("refuses links between businesses even from the unscoped client", async () => {
    const type = await prisma.productType.create({ data: { businessId: ids.b, name: "Apparel" } });
    await expect(
      prisma.product.create({
        data: { businessId: ids.b, slug: "tee", styleCode: "T1", name: "Tee", productTypeId: type.id, supplierId: ids.supplierA },
      }),
    ).rejects.toThrow(/Foreign key constraint/);

    const status = await prisma.orderStatus.create({ data: { businessId: ids.b, type: "ORDER", name: "New", isDefault: true } });
    await expect(
      prisma.order.create({ data: { businessId: ids.b, type: "ORDER", number: 1, customerId: ids.customerA, statusId: status.id } }),
    ).rejects.toThrow(/Foreign key constraint/);
  });
});
