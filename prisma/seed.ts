// Sets up a development platform: a platform admin, the Beeze Tees business
// with its starter data, and a Beeze Tees staff admin. Safe to run again.
//
// .env:
//   SEED_PLATFORM_ADMIN_EMAIL / SEED_PLATFORM_ADMIN_PASSWORD → /platform sign-in
//   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD                   → Beeze Tees /admin sign-in
import { forBusiness, prisma } from "../src/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password";
import { setUpBusiness } from "../src/lib/platform/setup";
import { beeze, categories, decorationMethods, defaultMarkupTiers, quantityDiscounts, suppliers } from "./seed-data";

function credentials(emailVar: string, passwordVar: string) {
  const email = process.env[emailVar]?.trim().toLowerCase();
  const password = process.env[passwordVar];
  if (!email || !password) return null;
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${passwordVar} must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return { email, password };
}

async function main() {
  const platformAdmin = credentials("SEED_PLATFORM_ADMIN_EMAIL", "SEED_PLATFORM_ADMIN_PASSWORD");
  if (platformAdmin) {
    // Only sets the password when creating the account.
    await prisma.platformUser.upsert({
      where: { email: platformAdmin.email },
      update: {},
      create: { email: platformAdmin.email, name: "Platform admin", passwordHash: await hashPassword(platformAdmin.password) },
    });
  }

  const business = await prisma.business.upsert({
    where: { slug: beeze.slug },
    update: {},
    create: { slug: beeze.slug, name: beeze.name },
  });
  const db = forBusiness(business.id);
  const businessId = business.id;
  await setUpBusiness(db);

  // Beeze Tees: flat 40% markup (setUpBusiness already defaults to it).
  const retail = await db.pricingGroup.findFirstOrThrow({ where: { isDefault: true } });
  if (!(await db.markupTier.count({ where: { pricingGroupId: retail.id } }))) {
    await db.markupTier.createMany({ data: defaultMarkupTiers.map((t) => ({ ...t, businessId, pricingGroupId: retail.id })) });
  }

  for (const q of quantityDiscounts) {
    await db.quantityDiscount.upsert({
      where: { businessId_name: { businessId, name: q.name } },
      update: {},
      create: { businessId, name: q.name, tiers: { create: q.tiers } },
    });
  }

  const apparel = await db.productType.findFirstOrThrow({ where: { name: "Apparel" } });
  for (const [i, m] of decorationMethods.entries()) {
    const { placeholderPrices, ...fields } = m;
    const method = await db.decorationMethod.upsert({
      where: { businessId_code: { businessId, code: m.code } },
      update: {},
      create: { ...fields, businessId, sortOrder: i },
    });
    await db.productTypeDecoration.upsert({
      where: { productTypeId_methodId: { productTypeId: apparel.id, methodId: method.id } },
      update: {},
      create: { businessId, productTypeId: apparel.id, methodId: method.id },
    });
    // Postgres treats NULLs as distinct in unique indexes, so look up the
    // default (group-less) table explicitly rather than upserting.
    if (!(await db.decorationPriceTable.findFirst({ where: { methodId: method.id, pricingGroupId: null } }))) {
      await db.decorationPriceTable.create({
        data: {
          businessId,
          methodId: method.id,
          name: `${m.shortName} default prices`,
          isPlaceholder: true,
          cells: {
            create: placeholderPrices.map(([minQty, dimensionMax, unitPrice]) => ({ minQty, dimensionMax, unitPrice })),
          },
        },
      });
    }
  }

  for (const s of suppliers) {
    await db.supplier.upsert({ where: { businessId_code: { businessId, code: s.code } }, update: {}, create: { ...s, businessId } });
  }

  for (const [i, c] of categories.entries()) {
    const parent = c.parent ? await db.category.findFirst({ where: { slug: c.parent } }) : null;
    await db.category.upsert({
      where: { businessId_slug: { businessId, slug: c.slug } },
      update: {},
      create: { businessId, slug: c.slug, name: c.name, sortOrder: i, parentId: parent?.id },
    });
  }

  const admin = credentials("SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD");
  if (admin) {
    await db.staffUser.upsert({
      where: { businessId_email: { businessId, email: admin.email } },
      update: {},
      create: { businessId, email: admin.email, name: "Admin", roles: ["ADMIN"], passwordHash: await hashPassword(admin.password) },
    });
  }

  console.log(`Seed complete: ${business.name} (${business.slug})${platformAdmin ? ", platform admin" : ""}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
