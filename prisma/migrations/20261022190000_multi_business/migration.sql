-- Multi-business. Existing single-business data (if any) moves into a
-- business created from the old ShopSettings row (id 'biz_beezetees').
-- On a fresh database there is no ShopSettings row and no business is made.

-- CreateEnum
CREATE TYPE "public"."BusinessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- DropForeignKey
ALTER TABLE "public"."Category" DROP CONSTRAINT "Category_parentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_productTypeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_quantityDiscountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductCategory" DROP CONSTRAINT "ProductCategory_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductCategory" DROP CONSTRAINT "ProductCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductColor" DROP CONSTRAINT "ProductColor_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductSize" DROP CONSTRAINT "ProductSize_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductVariant" DROP CONSTRAINT "ProductVariant_colorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductVariant" DROP CONSTRAINT "ProductVariant_sizeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductView" DROP CONSTRAINT "ProductView_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ViewImage" DROP CONSTRAINT "ViewImage_viewId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ViewImage" DROP CONSTRAINT "ViewImage_colorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DecorationArea" DROP CONSTRAINT "DecorationArea_viewId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductTypeDecoration" DROP CONSTRAINT "ProductTypeDecoration_productTypeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductTypeDecoration" DROP CONSTRAINT "ProductTypeDecoration_methodId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductDecorationRule" DROP CONSTRAINT "ProductDecorationRule_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductDecorationRule" DROP CONSTRAINT "ProductDecorationRule_methodId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DecorationPriceTable" DROP CONSTRAINT "DecorationPriceTable_methodId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DecorationPriceTable" DROP CONSTRAINT "DecorationPriceTable_pricingGroupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DecorationPriceCell" DROP CONSTRAINT "DecorationPriceCell_tableId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MarkupTier" DROP CONSTRAINT "MarkupTier_pricingGroupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."QuantityDiscountTier" DROP CONSTRAINT "QuantityDiscountTier_discountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_pricingGroupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Customer" DROP CONSTRAINT "Customer_pricingGroupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Customer" DROP CONSTRAINT "Customer_companyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Address" DROP CONSTRAINT "Address_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Design" DROP CONSTRAINT "Design_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Design" DROP CONSTRAINT "Design_colorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Design" DROP CONSTRAINT "Design_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DesignDecoration" DROP CONSTRAINT "DesignDecoration_designId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DesignDecoration" DROP CONSTRAINT "DesignDecoration_methodId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DesignDecoration" DROP CONSTRAINT "DesignDecoration_areaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_companyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_statusId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_pricingGroupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_quoteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderLine" DROP CONSTRAINT "OrderLine_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderLine" DROP CONSTRAINT "OrderLine_designId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderLineSize" DROP CONSTRAINT "OrderLineSize_lineId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderLineSize" DROP CONSTRAINT "OrderLineSize_sizeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderEvent" DROP CONSTRAINT "OrderEvent_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderEvent" DROP CONSTRAINT "OrderEvent_staffId_fkey";

-- DropIndex
DROP INDEX "public"."StaffUser_email_key";

-- DropIndex
DROP INDEX "public"."Supplier_code_key";

-- DropIndex
DROP INDEX "public"."Category_slug_key";

-- DropIndex
DROP INDEX "public"."Category_externalSource_externalId_key";

-- DropIndex
DROP INDEX "public"."ProductType_name_key";

-- DropIndex
DROP INDEX "public"."Product_slug_key";

-- DropIndex
DROP INDEX "public"."Product_supplierId_styleCode_idx";

-- DropIndex
DROP INDEX "public"."Product_externalSource_externalId_key";

-- DropIndex
DROP INDEX "public"."ProductVariant_sku_key";

-- DropIndex
DROP INDEX "public"."ProductVariant_externalSource_externalId_key";

-- DropIndex
DROP INDEX "public"."DecorationMethod_code_key";

-- DropIndex
DROP INDEX "public"."DecorationMethod_externalSource_externalId_key";

-- DropIndex
DROP INDEX "public"."PricingGroup_name_key";

-- DropIndex
DROP INDEX "public"."PricingGroup_externalSource_externalId_key";

-- DropIndex
DROP INDEX "public"."QuantityDiscount_name_key";

-- DropIndex
DROP INDEX "public"."Company_name_idx";

-- DropIndex
DROP INDEX "public"."Company_externalSource_externalId_key";

-- DropIndex
DROP INDEX "public"."Customer_email_idx";

-- DropIndex
DROP INDEX "public"."Customer_lastName_firstName_idx";

-- DropIndex
DROP INDEX "public"."Customer_externalSource_externalId_key";

-- DropIndex
DROP INDEX "public"."OrderStatus_type_name_key";

-- DropIndex
DROP INDEX "public"."Order_quoteId_key";

-- DropIndex
DROP INDEX "public"."Order_statusId_idx";

-- DropIndex
DROP INDEX "public"."Order_assignedToId_idx";

-- DropIndex
DROP INDEX "public"."Order_customerId_idx";

-- DropIndex
DROP INDEX "public"."Order_type_number_key";

-- DropIndex
DROP INDEX "public"."Order_externalSource_externalId_key";

-- AlterTable
ALTER TABLE "public"."StaffUser" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Supplier" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductType" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductCategory" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductColor" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductSize" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductView" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ViewImage" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."DecorationArea" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."DecorationMethod" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductTypeDecoration" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."ProductDecorationRule" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."DecorationPriceTable" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."DecorationPriceCell" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."PricingGroup" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."MarkupTier" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."QuantityDiscount" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."QuantityDiscountTier" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."TaxRate" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Company" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Address" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Design" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."DesignDecoration" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."OrderStatus" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."OrderLine" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."OrderLineSize" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."OrderEvent" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees';

-- AlterTable
ALTER TABLE "public"."Counter" DROP CONSTRAINT "Counter_pkey",
ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'biz_beezetees',
ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("businessId", "key");


-- CreateTable
CREATE TABLE "public"."Business" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customDomain" TEXT,
    "status" "public"."BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceRounding" "public"."PriceRounding" NOT NULL DEFAULT 'CENT',
    "rushFeePct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "paymentSurchargePct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlatformUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlatformSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

-- Backfill: the existing business, from the old shop settings.
INSERT INTO "public"."Business" ("id", "slug", "name", "customDomain", "currency", "priceRounding", "rushFeePct", "paymentSurchargePct", "updatedAt")
SELECT 'biz_beezetees', 'beezetees', "shopName", "primaryDomain", "currency", "priceRounding", "rushFeePct", "paymentSurchargePct", CURRENT_TIMESTAMP
FROM "public"."ShopSettings" WHERE "id" = 1;

DROP TABLE "public"."ShopSettings";

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "public"."Business"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Business_customDomain_key" ON "public"."Business"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "public"."PlatformUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSession_tokenHash_key" ON "public"."PlatformSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PlatformSession_userId_idx" ON "public"."PlatformSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_businessId_id_key" ON "public"."StaffUser"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_businessId_email_key" ON "public"."StaffUser"("businessId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_businessId_id_key" ON "public"."Supplier"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_businessId_code_key" ON "public"."Supplier"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_id_key" ON "public"."Category"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_slug_key" ON "public"."Category"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_externalSource_externalId_key" ON "public"."Category"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_businessId_id_key" ON "public"."ProductType"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_businessId_name_key" ON "public"."ProductType"("businessId", "name");

-- CreateIndex
CREATE INDEX "Product_businessId_supplierId_styleCode_idx" ON "public"."Product"("businessId", "supplierId", "styleCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_id_key" ON "public"."Product"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_slug_key" ON "public"."Product"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_externalSource_externalId_key" ON "public"."Product"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductColor_businessId_id_key" ON "public"."ProductColor"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductColor_productId_id_key" ON "public"."ProductColor"("productId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_businessId_id_key" ON "public"."ProductSize"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_businessId_sku_key" ON "public"."ProductVariant"("businessId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_businessId_externalSource_externalId_key" ON "public"."ProductVariant"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductView_businessId_id_key" ON "public"."ProductView"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationArea_businessId_id_key" ON "public"."DecorationArea"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationMethod_businessId_id_key" ON "public"."DecorationMethod"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationMethod_businessId_code_key" ON "public"."DecorationMethod"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationMethod_businessId_externalSource_externalId_key" ON "public"."DecorationMethod"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationPriceTable_businessId_id_key" ON "public"."DecorationPriceTable"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PricingGroup_businessId_id_key" ON "public"."PricingGroup"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PricingGroup_businessId_name_key" ON "public"."PricingGroup"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PricingGroup_businessId_externalSource_externalId_key" ON "public"."PricingGroup"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "QuantityDiscount_businessId_id_key" ON "public"."QuantityDiscount"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuantityDiscount_businessId_name_key" ON "public"."QuantityDiscount"("businessId", "name");

-- CreateIndex
CREATE INDEX "TaxRate_businessId_idx" ON "public"."TaxRate"("businessId");

-- CreateIndex
CREATE INDEX "Company_businessId_name_idx" ON "public"."Company"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_businessId_id_key" ON "public"."Company"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Company_businessId_externalSource_externalId_key" ON "public"."Company"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "Customer_businessId_email_idx" ON "public"."Customer"("businessId", "email");

-- CreateIndex
CREATE INDEX "Customer_businessId_lastName_firstName_idx" ON "public"."Customer"("businessId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_id_key" ON "public"."Customer"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_externalSource_externalId_key" ON "public"."Customer"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Design_businessId_id_key" ON "public"."Design"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatus_businessId_id_key" ON "public"."OrderStatus"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatus_businessId_type_name_key" ON "public"."OrderStatus"("businessId", "type", "name");

-- CreateIndex
CREATE INDEX "Order_businessId_statusId_idx" ON "public"."Order"("businessId", "statusId");

-- CreateIndex
CREATE INDEX "Order_businessId_assignedToId_idx" ON "public"."Order"("businessId", "assignedToId");

-- CreateIndex
CREATE INDEX "Order_businessId_customerId_idx" ON "public"."Order"("businessId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_id_key" ON "public"."Order"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_type_number_key" ON "public"."Order"("businessId", "type", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_quoteId_key" ON "public"."Order"("businessId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_externalSource_externalId_key" ON "public"."Order"("businessId", "externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_businessId_id_key" ON "public"."OrderLine"("businessId", "id");

-- AddForeignKey
ALTER TABLE "public"."PlatformSession" ADD CONSTRAINT "PlatformSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StaffUser" ADD CONSTRAINT "StaffUser_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_businessId_parentId_fkey" FOREIGN KEY ("businessId", "parentId") REFERENCES "public"."Category"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductType" ADD CONSTRAINT "ProductType_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_businessId_supplierId_fkey" FOREIGN KEY ("businessId", "supplierId") REFERENCES "public"."Supplier"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_businessId_productTypeId_fkey" FOREIGN KEY ("businessId", "productTypeId") REFERENCES "public"."ProductType"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_businessId_quantityDiscountId_fkey" FOREIGN KEY ("businessId", "quantityDiscountId") REFERENCES "public"."QuantityDiscount"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductCategory" ADD CONSTRAINT "ProductCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductCategory" ADD CONSTRAINT "ProductCategory_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "public"."Product"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductCategory" ADD CONSTRAINT "ProductCategory_businessId_categoryId_fkey" FOREIGN KEY ("businessId", "categoryId") REFERENCES "public"."Category"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductColor" ADD CONSTRAINT "ProductColor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductColor" ADD CONSTRAINT "ProductColor_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "public"."Product"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductSize" ADD CONSTRAINT "ProductSize_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductSize" ADD CONSTRAINT "ProductSize_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "public"."Product"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "public"."Product"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_businessId_colorId_fkey" FOREIGN KEY ("businessId", "colorId") REFERENCES "public"."ProductColor"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_businessId_sizeId_fkey" FOREIGN KEY ("businessId", "sizeId") REFERENCES "public"."ProductSize"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductView" ADD CONSTRAINT "ProductView_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductView" ADD CONSTRAINT "ProductView_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "public"."Product"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewImage" ADD CONSTRAINT "ViewImage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewImage" ADD CONSTRAINT "ViewImage_businessId_viewId_fkey" FOREIGN KEY ("businessId", "viewId") REFERENCES "public"."ProductView"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewImage" ADD CONSTRAINT "ViewImage_businessId_colorId_fkey" FOREIGN KEY ("businessId", "colorId") REFERENCES "public"."ProductColor"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationArea" ADD CONSTRAINT "DecorationArea_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationArea" ADD CONSTRAINT "DecorationArea_businessId_viewId_fkey" FOREIGN KEY ("businessId", "viewId") REFERENCES "public"."ProductView"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationMethod" ADD CONSTRAINT "DecorationMethod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTypeDecoration" ADD CONSTRAINT "ProductTypeDecoration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTypeDecoration" ADD CONSTRAINT "ProductTypeDecoration_businessId_productTypeId_fkey" FOREIGN KEY ("businessId", "productTypeId") REFERENCES "public"."ProductType"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTypeDecoration" ADD CONSTRAINT "ProductTypeDecoration_businessId_methodId_fkey" FOREIGN KEY ("businessId", "methodId") REFERENCES "public"."DecorationMethod"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductDecorationRule" ADD CONSTRAINT "ProductDecorationRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductDecorationRule" ADD CONSTRAINT "ProductDecorationRule_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "public"."Product"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductDecorationRule" ADD CONSTRAINT "ProductDecorationRule_businessId_methodId_fkey" FOREIGN KEY ("businessId", "methodId") REFERENCES "public"."DecorationMethod"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceTable" ADD CONSTRAINT "DecorationPriceTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceTable" ADD CONSTRAINT "DecorationPriceTable_businessId_methodId_fkey" FOREIGN KEY ("businessId", "methodId") REFERENCES "public"."DecorationMethod"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceTable" ADD CONSTRAINT "DecorationPriceTable_businessId_pricingGroupId_fkey" FOREIGN KEY ("businessId", "pricingGroupId") REFERENCES "public"."PricingGroup"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceCell" ADD CONSTRAINT "DecorationPriceCell_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceCell" ADD CONSTRAINT "DecorationPriceCell_businessId_tableId_fkey" FOREIGN KEY ("businessId", "tableId") REFERENCES "public"."DecorationPriceTable"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PricingGroup" ADD CONSTRAINT "PricingGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarkupTier" ADD CONSTRAINT "MarkupTier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarkupTier" ADD CONSTRAINT "MarkupTier_businessId_pricingGroupId_fkey" FOREIGN KEY ("businessId", "pricingGroupId") REFERENCES "public"."PricingGroup"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuantityDiscount" ADD CONSTRAINT "QuantityDiscount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuantityDiscountTier" ADD CONSTRAINT "QuantityDiscountTier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuantityDiscountTier" ADD CONSTRAINT "QuantityDiscountTier_businessId_discountId_fkey" FOREIGN KEY ("businessId", "discountId") REFERENCES "public"."QuantityDiscount"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxRate" ADD CONSTRAINT "TaxRate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_businessId_pricingGroupId_fkey" FOREIGN KEY ("businessId", "pricingGroupId") REFERENCES "public"."PricingGroup"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_businessId_pricingGroupId_fkey" FOREIGN KEY ("businessId", "pricingGroupId") REFERENCES "public"."PricingGroup"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_businessId_companyId_fkey" FOREIGN KEY ("businessId", "companyId") REFERENCES "public"."Company"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_businessId_productId_fkey" FOREIGN KEY ("businessId", "productId") REFERENCES "public"."Product"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_productId_colorId_fkey" FOREIGN KEY ("productId", "colorId") REFERENCES "public"."ProductColor"("productId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_businessId_designId_fkey" FOREIGN KEY ("businessId", "designId") REFERENCES "public"."Design"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_businessId_methodId_fkey" FOREIGN KEY ("businessId", "methodId") REFERENCES "public"."DecorationMethod"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_businessId_areaId_fkey" FOREIGN KEY ("businessId", "areaId") REFERENCES "public"."DecorationArea"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderStatus" ADD CONSTRAINT "OrderStatus_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_companyId_fkey" FOREIGN KEY ("businessId", "companyId") REFERENCES "public"."Company"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_statusId_fkey" FOREIGN KEY ("businessId", "statusId") REFERENCES "public"."OrderStatus"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_assignedToId_fkey" FOREIGN KEY ("businessId", "assignedToId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_pricingGroupId_fkey" FOREIGN KEY ("businessId", "pricingGroupId") REFERENCES "public"."PricingGroup"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_quoteId_fkey" FOREIGN KEY ("businessId", "quoteId") REFERENCES "public"."Order"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLine" ADD CONSTRAINT "OrderLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLine" ADD CONSTRAINT "OrderLine_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLine" ADD CONSTRAINT "OrderLine_businessId_designId_fkey" FOREIGN KEY ("businessId", "designId") REFERENCES "public"."Design"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLineSize" ADD CONSTRAINT "OrderLineSize_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLineSize" ADD CONSTRAINT "OrderLineSize_businessId_lineId_fkey" FOREIGN KEY ("businessId", "lineId") REFERENCES "public"."OrderLine"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLineSize" ADD CONSTRAINT "OrderLineSize_businessId_sizeId_fkey" FOREIGN KEY ("businessId", "sizeId") REFERENCES "public"."ProductSize"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_businessId_staffId_fkey" FOREIGN KEY ("businessId", "staffId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Counter" ADD CONSTRAINT "Counter_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill done; new rows must say which business they belong to.
ALTER TABLE "public"."StaffUser" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Supplier" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Category" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductType" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Product" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductCategory" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductColor" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductSize" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductVariant" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductView" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ViewImage" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."DecorationArea" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."DecorationMethod" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductTypeDecoration" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."ProductDecorationRule" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."DecorationPriceTable" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."DecorationPriceCell" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."PricingGroup" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."MarkupTier" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."QuantityDiscount" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."QuantityDiscountTier" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."TaxRate" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Company" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Customer" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Address" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Design" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."DesignDecoration" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."OrderStatus" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Order" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."OrderLine" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."OrderLineSize" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."OrderEvent" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "public"."Counter" ALTER COLUMN "businessId" DROP DEFAULT;
