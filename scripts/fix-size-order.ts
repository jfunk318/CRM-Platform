// Put every product's sizes in the expected order (smallest to largest) in
// the database, for products imported before sizes were sorted:
//
//   npm run fix-size-order
//
// Safe to run more than once.
import { PrismaClient } from "@prisma/client";
import { sizeRank } from "../src/lib/catalog/sizes";

const prisma = new PrismaClient();

async function main() {
  const sizes = await prisma.productSize.findMany({ select: { id: true, productId: true, code: true, sortOrder: true }, orderBy: [{ productId: "asc" }, { sortOrder: "asc" }] });
  const byProduct = new Map<string, typeof sizes>();
  for (const s of sizes) byProduct.set(s.productId, [...(byProduct.get(s.productId) ?? []), s]);
  let products = 0;
  let changed = 0;
  for (const list of byProduct.values()) {
    const sorted = [...list].sort((a, b) => sizeRank(a.code) - sizeRank(b.code) || a.sortOrder - b.sortOrder);
    const updates = sorted.flatMap((s, i) => (s.sortOrder === i ? [] : [prisma.productSize.update({ where: { id: s.id }, data: { sortOrder: i } })]));
    if (updates.length) {
      await prisma.$transaction(updates);
      products++;
      changed += updates.length;
    }
  }
  console.log(products ? `Re-ordered sizes on ${products} product${products === 1 ? "" : "s"} (${changed} sizes moved).` : "All sizes were already in order.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
