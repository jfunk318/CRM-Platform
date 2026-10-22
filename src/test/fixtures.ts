// Builds a throwaway business with enough data to quote and order:
// statuses (with roles), a customer with an email, a staff member, a
// product in two colors and a screen-print method. Delete the business
// afterwards to remove everything.
import { type BusinessDb, forBusiness, prisma } from "@/lib/db";
import { DEFAULT_ORDER_STATUSES } from "@/lib/platform/setup";

export async function makeTestBusiness(tag: string) {
  const business = await prisma.business.create({ data: { slug: tag, name: `Test ${tag}`, email: "shop@example.com" } });
  const businessId = business.id;
  const db: BusinessDb = forBusiness(businessId);
  await db.orderStatus.createMany({ data: DEFAULT_ORDER_STATUSES.map((s, i) => ({ ...s, businessId, sortOrder: i })) });
  const staff = await db.staffUser.create({ data: { businessId, email: "rep@example.com", name: "Rep", roles: ["ADMIN"] } });
  const group = await db.pricingGroup.create({
    data: { businessId, name: "Retail", isDefault: true, markupTiers: { create: [{ costFrom: 0, costTo: null, pct: 0.4 }] } },
  });
  const method = await db.decorationMethod.create({
    data: {
      businessId,
      code: "SCR",
      name: "Screen print",
      shortName: "Screen",
      kind: "SCREEN_PRINT",
      pricingModel: "PER_COLOR",
      minQty: 12,
      screenSetupFee: 20,
      priceTables: { create: { name: "t", cells: { create: [{ minQty: 12, dimensionMax: 4, unitPrice: 3 }] } } },
    },
  });
  const type = await db.productType.create({ data: { businessId, name: "Apparel", decorationMethods: { create: { methodId: method.id } } } });
  const product = await db.product.create({
    data: {
      businessId,
      slug: "tee",
      styleCode: "T1",
      name: "Tee",
      productTypeId: type.id,
      colors: { create: [{ name: "Navy", shade: "DARK" }] },
      sizes: { create: [{ code: "M", label: "M" }] },
    },
    include: { colors: true, sizes: true },
  });
  await db.productVariant.create({
    data: { businessId, productId: product.id, colorId: product.colors[0].id, sizeId: product.sizes[0].id, sku: "T1-NAVY-M", wholesaleCost: 5 },
  });
  const customer = await db.customer.create({ data: { businessId, firstName: "Pat", lastName: "Lee", email: "pat@example.com" } });
  return {
    business,
    db,
    staff,
    group,
    method,
    product,
    customer,
    line: (qty = 12) => ({
      productId: product.id,
      colorId: product.colors[0].id,
      quantities: { [product.sizes[0].id]: qty },
      decorations: [{ methodId: method.id, location: "Front", colors: 1 }],
    }),
    cleanup: () => prisma.business.delete({ where: { id: businessId } }),
  };
}
