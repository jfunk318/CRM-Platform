-- CreateEnum
CREATE TYPE "public"."OrderSource" AS ENUM ('STAFF', 'STOREFRONT', 'QUOTE_REQUEST');

-- CreateEnum
CREATE TYPE "public"."AccountMode" AS ENUM ('OPTIONAL', 'REQUIRED', 'GUEST_ONLY');

-- CreateEnum
CREATE TYPE "public"."StoreKind" AS ENUM ('ROOT', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "public"."MarkupKind" AS ENUM ('AMOUNT', 'PERCENT');

-- CreateEnum
CREATE TYPE "public"."CartStatus" AS ENUM ('OPEN', 'CHECKOUT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."PromoKind" AS ENUM ('PERCENT', 'AMOUNT', 'FREE_SHIPPING');

-- AlterEnum
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'GIFT_CARD';

-- AlterTable
ALTER TABLE "public"."Business" ADD COLUMN     "defaultAccountMode" "public"."AccountMode" NOT NULL DEFAULT 'OPTIONAL',
ADD COLUMN     "defaultAllowPayLater" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultShowPrices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stripeSecretKeyEnc" TEXT,
ADD COLUMN     "stripeWebhookSecretEnc" TEXT;

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "placedAt" TIMESTAMP(3),
ADD COLUMN     "promoCodeId" TEXT,
ADD COLUMN     "source" "public"."OrderSource" NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "public"."OrderLine" ADD COLUMN     "fixedPrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storeItemId" TEXT;

-- CreateTable
CREATE TABLE "public"."Store" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "public"."StoreKind" NOT NULL DEFAULT 'ROOT',
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "logoFileId" TEXT,
    "accentColor" TEXT,
    "announcement" TEXT,
    "footerText" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "accountMode" "public"."AccountMode",
    "accessCode" TEXT,
    "showPrices" BOOLEAN,
    "allowPayLater" BOOLEAN,
    "markupKind" "public"."MarkupKind",
    "markupValue" DECIMAL(10,2),
    "customDeliveryMethods" BOOLEAN NOT NULL DEFAULT false,
    "ga4Id" TEXT,
    "metaPixelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreDeliveryMethod" (
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "deliveryMethodId" TEXT NOT NULL,

    CONSTRAINT "StoreDeliveryMethod_pkey" PRIMARY KEY ("storeId","deliveryMethodId")
);

-- CreateTable
CREATE TABLE "public"."StorePage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "parentId" TEXT,
    "showInNav" BOOLEAN NOT NULL DEFAULT false,
    "navOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageFileId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "markupKind" "public"."MarkupKind",
    "markupValue" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreItemPrice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "overridePrice" DECIMAL(10,2),

    CONSTRAINT "StoreItemPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cart" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "public"."CartStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "shipName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipRegion" TEXT,
    "shipPostalCode" TEXT,
    "shipCountry" TEXT NOT NULL DEFAULT 'US',
    "deliveryMethodId" TEXT,
    "promoCodeId" TEXT,
    "giftCodeId" TEXT,
    "note" TEXT,
    "amountDue" DECIMAL(10,2),
    "checkoutSessionId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CartItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromoCode" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "kind" "public"."PromoKind" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minSubtotal" DECIMAL(10,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GiftCode" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialAmount" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GiftCodeUse" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "giftCodeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCodeUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerToken" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "customerId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_businessId_id_key" ON "public"."Store"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Store_businessId_slug_key" ON "public"."Store"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "StorePage_businessId_id_key" ON "public"."StorePage"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StorePage_storeId_slug_key" ON "public"."StorePage"("storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_businessId_id_key" ON "public"."StoreItem"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_storeId_slug_key" ON "public"."StoreItem"("storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItemPrice_itemId_sizeId_key" ON "public"."StoreItemPrice"("itemId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_tokenHash_key" ON "public"."Cart"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_checkoutSessionId_key" ON "public"."Cart"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_businessId_id_key" ON "public"."Cart"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_storeItemId_sizeId_key" ON "public"."CartItem"("cartId", "storeItemId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_businessId_id_key" ON "public"."PromoCode"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_businessId_code_key" ON "public"."PromoCode"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCode_businessId_id_key" ON "public"."GiftCode"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCode_businessId_code_key" ON "public"."GiftCode"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "public"."CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_businessId_customerId_idx" ON "public"."CustomerSession"("businessId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerToken_tokenHash_key" ON "public"."CustomerToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerToken_businessId_email_idx" ON "public"."CustomerToken"("businessId", "email");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_promoCodeId_fkey" FOREIGN KEY ("businessId", "promoCodeId") REFERENCES "public"."PromoCode"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLine" ADD CONSTRAINT "OrderLine_businessId_storeItemId_fkey" FOREIGN KEY ("businessId", "storeItemId") REFERENCES "public"."StoreItem"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_logoFileId_fkey" FOREIGN KEY ("businessId", "logoFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreDeliveryMethod" ADD CONSTRAINT "StoreDeliveryMethod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreDeliveryMethod" ADD CONSTRAINT "StoreDeliveryMethod_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreDeliveryMethod" ADD CONSTRAINT "StoreDeliveryMethod_businessId_deliveryMethodId_fkey" FOREIGN KEY ("businessId", "deliveryMethodId") REFERENCES "public"."DeliveryMethod"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StorePage" ADD CONSTRAINT "StorePage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StorePage" ADD CONSTRAINT "StorePage_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StorePage" ADD CONSTRAINT "StorePage_businessId_parentId_fkey" FOREIGN KEY ("businessId", "parentId") REFERENCES "public"."StorePage"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreItem" ADD CONSTRAINT "StoreItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreItem" ADD CONSTRAINT "StoreItem_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreItem" ADD CONSTRAINT "StoreItem_businessId_designId_fkey" FOREIGN KEY ("businessId", "designId") REFERENCES "public"."Design"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreItem" ADD CONSTRAINT "StoreItem_businessId_imageFileId_fkey" FOREIGN KEY ("businessId", "imageFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreItemPrice" ADD CONSTRAINT "StoreItemPrice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreItemPrice" ADD CONSTRAINT "StoreItemPrice_businessId_itemId_fkey" FOREIGN KEY ("businessId", "itemId") REFERENCES "public"."StoreItem"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreItemPrice" ADD CONSTRAINT "StoreItemPrice_businessId_sizeId_fkey" FOREIGN KEY ("businessId", "sizeId") REFERENCES "public"."ProductSize"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_businessId_deliveryMethodId_fkey" FOREIGN KEY ("businessId", "deliveryMethodId") REFERENCES "public"."DeliveryMethod"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_businessId_promoCodeId_fkey" FOREIGN KEY ("businessId", "promoCodeId") REFERENCES "public"."PromoCode"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_businessId_giftCodeId_fkey" FOREIGN KEY ("businessId", "giftCodeId") REFERENCES "public"."GiftCode"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_businessId_cartId_fkey" FOREIGN KEY ("businessId", "cartId") REFERENCES "public"."Cart"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_businessId_storeItemId_fkey" FOREIGN KEY ("businessId", "storeItemId") REFERENCES "public"."StoreItem"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromoCode" ADD CONSTRAINT "PromoCode_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiftCode" ADD CONSTRAINT "GiftCode_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiftCodeUse" ADD CONSTRAINT "GiftCodeUse_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiftCodeUse" ADD CONSTRAINT "GiftCodeUse_businessId_giftCodeId_fkey" FOREIGN KEY ("businessId", "giftCodeId") REFERENCES "public"."GiftCode"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiftCodeUse" ADD CONSTRAINT "GiftCodeUse_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerSession" ADD CONSTRAINT "CustomerSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerSession" ADD CONSTRAINT "CustomerSession_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerToken" ADD CONSTRAINT "CustomerToken_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerToken" ADD CONSTRAINT "CustomerToken_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every business gets its root storefront, with a starter home page.
INSERT INTO "Store" ("id", "businessId", "kind", "name", "updatedAt")
SELECT 'st_' || replace(gen_random_uuid()::text, '-', ''), b."id", 'ROOT', b."name", now()
FROM "Business" b
WHERE NOT EXISTS (SELECT 1 FROM "Store" s WHERE s."businessId" = b."id" AND s."kind" = 'ROOT');

INSERT INTO "StorePage" ("id", "businessId", "storeId", "slug", "title", "body", "updatedAt")
SELECT 'pg_' || replace(gen_random_uuid()::text, '-', ''), s."businessId", s."id", 'home', 'Home',
  E'# Custom apparel, printed in-house\n\nScreen printing, embroidery and more. Browse the [catalog](/catalog) or [request a quote](/quote).',
  now()
FROM "Store" s
WHERE s."kind" = 'ROOT' AND NOT EXISTS (SELECT 1 FROM "StorePage" p WHERE p."storeId" = s."id" AND p."slug" = 'home');
