import { PrismaClient } from "@prisma/client";
import {
  categories,
  decorationMethods,
  defaultMarkupTiers,
  orderStatuses,
  quantityDiscounts,
  shop,
  suppliers,
} from "./seed-data";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.shopSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...shop } });

  const group = await prisma.pricingGroup.upsert({
    where: { name: "Retail" },
    update: {},
    create: { name: "Retail", isDefault: true, markupMode: "MARKUP" },
  });
  if ((await prisma.markupTier.count({ where: { pricingGroupId: group.id } })) === 0) {
    await prisma.markupTier.createMany({
      data: defaultMarkupTiers.map((t) => ({ ...t, pricingGroupId: group.id })),
    });
  }

  for (const q of quantityDiscounts) {
    await prisma.quantityDiscount.upsert({
      where: { name: q.name },
      update: {},
      create: { name: q.name, tiers: { create: q.tiers } },
    });
  }

  const apparel = await prisma.productType.upsert({
    where: { name: "Apparel" },
    update: {},
    create: { name: "Apparel", allowProcessMix: true },
  });

  for (const [i, m] of decorationMethods.entries()) {
    const { placeholderPrices, ...fields } = m;
    const method = await prisma.decorationMethod.upsert({
      where: { code: m.code },
      update: {},
      create: { ...fields, sortOrder: i },
    });
    await prisma.productTypeDecoration.upsert({
      where: { productTypeId_methodId: { productTypeId: apparel.id, methodId: method.id } },
      update: {},
      create: { productTypeId: apparel.id, methodId: method.id },
    });
    // Postgres treats NULLs as distinct in unique indexes, so look up the
    // default (group-less) table explicitly rather than upserting.
    const existing = await prisma.decorationPriceTable.findFirst({
      where: { methodId: method.id, pricingGroupId: null },
    });
    if (!existing) {
      await prisma.decorationPriceTable.create({
        data: {
          methodId: method.id,
          name: `${m.shortName} default prices`,
          isPlaceholder: true,
          cells: {
            create: placeholderPrices.map(([minQty, dimensionMax, unitPrice]) => ({
              minQty,
              dimensionMax,
              unitPrice,
            })),
          },
        },
      });
    }
  }

  for (const s of suppliers) {
    await prisma.supplier.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  for (const [i, c] of categories.entries()) {
    const parent = c.parent ? await prisma.category.findUnique({ where: { slug: c.parent } }) : null;
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, name: c.name, sortOrder: i, parentId: parent?.id },
    });
  }

  for (const [type, statuses] of Object.entries(Object.groupBy(orderStatuses, (o) => o.type))) {
    // Only seed a type's statuses once; after that they're managed in admin.
    if (await prisma.orderStatus.count({ where: { type: type as "QUOTE" | "ORDER" } })) continue;
    await prisma.orderStatus.createMany({ data: statuses!.map((st, i) => ({ ...st, sortOrder: i })) });
  }
  for (const key of ["quote", "order"]) {
    await prisma.counter.upsert({ where: { key }, update: {}, create: { key, value: 1000 } });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    // Only sets the password when creating the account; change it in admin afterwards.
    await prisma.staffUser.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        name: "Admin",
        roles: ["ADMIN"],
        passwordHash: await hashPassword(adminPassword),
      },
    });
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
