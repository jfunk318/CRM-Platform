-- AlterEnum
ALTER TYPE "public"."StaffRole" ADD VALUE 'STORE_MANAGER';

-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "closesAt" TIMESTAMP(3),
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "opensAt" TIMESTAMP(3),
ADD COLUMN     "showcase" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."PromoCode" ADD COLUMN     "allStores" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."GiftCode" ADD COLUMN     "allStores" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."StoreGroup" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "accountMode" "public"."AccountMode",
    "showPrices" BOOLEAN,
    "allowPayLater" BOOLEAN,
    "markupKind" "public"."MarkupKind",
    "markupValue" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromoCodeStore" (
    "businessId" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,

    CONSTRAINT "PromoCodeStore_pkey" PRIMARY KEY ("promoCodeId","storeId")
);

-- CreateTable
CREATE TABLE "public"."GiftCodeStore" (
    "businessId" TEXT NOT NULL,
    "giftCodeId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,

    CONSTRAINT "GiftCodeStore_pkey" PRIMARY KEY ("giftCodeId","storeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreGroup_businessId_id_key" ON "public"."StoreGroup"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StoreGroup_businessId_name_key" ON "public"."StoreGroup"("businessId", "name");

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_managerId_fkey" FOREIGN KEY ("businessId", "managerId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_groupId_fkey" FOREIGN KEY ("businessId", "groupId") REFERENCES "public"."StoreGroup"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreGroup" ADD CONSTRAINT "StoreGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromoCodeStore" ADD CONSTRAINT "PromoCodeStore_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromoCodeStore" ADD CONSTRAINT "PromoCodeStore_businessId_promoCodeId_fkey" FOREIGN KEY ("businessId", "promoCodeId") REFERENCES "public"."PromoCode"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromoCodeStore" ADD CONSTRAINT "PromoCodeStore_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiftCodeStore" ADD CONSTRAINT "GiftCodeStore_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiftCodeStore" ADD CONSTRAINT "GiftCodeStore_businessId_giftCodeId_fkey" FOREIGN KEY ("businessId", "giftCodeId") REFERENCES "public"."GiftCode"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiftCodeStore" ADD CONSTRAINT "GiftCodeStore_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The storefront built so far was the first affiliate store's, not the
-- business's own site: it becomes "Affiliate Store 1" at store1.<domain>,
-- keeping its items, pages and settings, and each business gets a fresh
-- main site that showcases its stores.
UPDATE "Store" s SET "kind" = 'AFFILIATE', "slug" = 'store1', "name" = 'Affiliate Store 1'
WHERE s."kind" = 'ROOT'
  AND NOT EXISTS (SELECT 1 FROM "Store" o WHERE o."businessId" = s."businessId" AND o."slug" = 'store1');

INSERT INTO "Store" ("id", "businessId", "kind", "name", "updatedAt")
SELECT 'st_' || replace(gen_random_uuid()::text, '-', ''), b."id", 'ROOT', b."name", now()
FROM "Business" b
WHERE NOT EXISTS (SELECT 1 FROM "Store" s WHERE s."businessId" = b."id" AND s."kind" = 'ROOT');

INSERT INTO "StorePage" ("id", "businessId", "storeId", "slug", "title", "body", "updatedAt")
SELECT 'pg_' || replace(gen_random_uuid()::text, '-', ''), s."businessId", s."id", 'home', 'Home',
  '# ' || s."name" || E'\n\nCustom apparel, screen printing and embroidery. Browse the [catalog](/catalog) or [request a quote](/quote).\n\n## Team and organization stores\n\n[[stores]]',
  now()
FROM "Store" s
WHERE s."kind" = 'ROOT' AND NOT EXISTS (SELECT 1 FROM "StorePage" p WHERE p."storeId" = s."id" AND p."slug" = 'home');
