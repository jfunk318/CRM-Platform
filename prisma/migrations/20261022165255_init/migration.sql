-- CreateEnum
CREATE TYPE "public"."StaffRole" AS ENUM ('ADMIN', 'SALES', 'ARTWORK', 'ARTWORK_MANAGER', 'PRODUCTION', 'PURCHASING', 'SHIPPING', 'REFUNDS');

-- CreateEnum
CREATE TYPE "public"."SupplierIntegration" AS ENUM ('REST_API', 'PROMOSTANDARDS', 'CSV', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('ACTIVE', 'CLOSING_OUT', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "public"."GarmentShade" AS ENUM ('WHITE', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "public"."DecorationKind" AS ENUM ('SCREEN_PRINT', 'EMBROIDERY', 'DTF', 'DIGITAL', 'VINYL', 'TRANSFER', 'ENGRAVING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DecorationPricingModel" AS ENUM ('PER_COLOR', 'PER_STITCH', 'AREA', 'FLAT');

-- CreateEnum
CREATE TYPE "public"."MarkupMode" AS ENUM ('MARKUP', 'MARGIN');

-- CreateEnum
CREATE TYPE "public"."PriceRounding" AS ENUM ('CENT', 'UP_TO_99');

-- CreateTable
CREATE TABLE "public"."StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "roles" "public"."StaffRole"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "integration" "public"."SupplierIntegration" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allowProcessMix" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "styleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "allowBlankSale" BOOLEAN NOT NULL DEFAULT true,
    "sizeChartHtml" TEXT,
    "sizeChartImageUrl" TEXT,
    "specSheetUrl" TEXT,
    "productionLeadDays" INTEGER,
    "supplierId" TEXT,
    "productTypeId" TEXT NOT NULL,
    "quantityDiscountId" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "public"."ProductColor" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT,
    "shade" "public"."GarmentShade" NOT NULL DEFAULT 'LIGHT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductSize" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "supplierSku" TEXT,
    "wholesaleCost" DECIMAL(10,2) NOT NULL,
    "stockOnHand" INTEGER,
    "supplierStock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "externalSource" TEXT,
    "externalId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductView" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ViewImage" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "ViewImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DecorationArea" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthIn" DECIMAL(6,2) NOT NULL,
    "heightIn" DECIMAL(6,2) NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DecorationArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DecorationMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT,
    "kind" "public"."DecorationKind" NOT NULL,
    "pricingModel" "public"."DecorationPricingModel" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "maxColors" INTEGER,
    "minDpi" INTEGER,
    "perfectDpi" INTEGER,
    "productionLeadDays" INTEGER NOT NULL DEFAULT 14,
    "screenSetupFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "chargeWhiteBaseScreen" BOOLEAN NOT NULL DEFAULT true,
    "useWhiteBaseOnDark" BOOLEAN NOT NULL DEFAULT true,
    "artworkFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "digitizingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "digitizingFeePerInch" BOOLEAN NOT NULL DEFAULT false,
    "proofingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "combineSameDesignQty" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecorationMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductTypeDecoration" (
    "productTypeId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,

    CONSTRAINT "ProductTypeDecoration_pkey" PRIMARY KEY ("productTypeId","methodId")
);

-- CreateTable
CREATE TABLE "public"."ProductDecorationRule" (
    "productId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minQty" INTEGER,

    CONSTRAINT "ProductDecorationRule_pkey" PRIMARY KEY ("productId","methodId")
);

-- CreateTable
CREATE TABLE "public"."DecorationPriceTable" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "pricingGroupId" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "DecorationPriceTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DecorationPriceCell" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "dimensionMax" DECIMAL(10,2),
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DecorationPriceCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PricingGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "markupMode" "public"."MarkupMode" NOT NULL DEFAULT 'MARKUP',
    "externalSource" TEXT,
    "externalId" TEXT,

    CONSTRAINT "PricingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarkupTier" (
    "id" TEXT NOT NULL,
    "pricingGroupId" TEXT NOT NULL,
    "costFrom" DECIMAL(10,2) NOT NULL,
    "costTo" DECIMAL(10,2),
    "pct" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "MarkupTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuantityDiscount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "QuantityDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuantityDiscountTier" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "pct" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "QuantityDiscountTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(7,5) NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "region" TEXT,
    "postalPrefixes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "taxShipping" BOOLEAN NOT NULL DEFAULT false,
    "taxArtworkFee" BOOLEAN NOT NULL DEFAULT true,
    "taxDigitizingFee" BOOLEAN NOT NULL DEFAULT true,
    "taxRushFee" BOOLEAN NOT NULL DEFAULT true,
    "taxScreenSetupFee" BOOLEAN NOT NULL DEFAULT true,
    "taxPaymentSurcharge" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShopSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "shopName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceRounding" "public"."PriceRounding" NOT NULL DEFAULT 'CENT',
    "rushFeePct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "paymentSurchargePct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "public"."StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "public"."Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "public"."Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_externalSource_externalId_key" ON "public"."Category"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_key" ON "public"."ProductType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "public"."Product"("slug");

-- CreateIndex
CREATE INDEX "Product_supplierId_styleCode_idx" ON "public"."Product"("supplierId", "styleCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalSource_externalId_key" ON "public"."Product"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductColor_productId_name_key" ON "public"."ProductColor"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_productId_code_key" ON "public"."ProductSize"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "public"."ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_colorId_sizeId_key" ON "public"."ProductVariant"("productId", "colorId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_externalSource_externalId_key" ON "public"."ProductVariant"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductView_productId_name_key" ON "public"."ProductView"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ViewImage_viewId_colorId_key" ON "public"."ViewImage"("viewId", "colorId");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationMethod_code_key" ON "public"."DecorationMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationMethod_externalSource_externalId_key" ON "public"."DecorationMethod"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationPriceTable_methodId_pricingGroupId_key" ON "public"."DecorationPriceTable"("methodId", "pricingGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "DecorationPriceCell_tableId_minQty_dimensionMax_key" ON "public"."DecorationPriceCell"("tableId", "minQty", "dimensionMax");

-- CreateIndex
CREATE UNIQUE INDEX "PricingGroup_name_key" ON "public"."PricingGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PricingGroup_externalSource_externalId_key" ON "public"."PricingGroup"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "QuantityDiscount_name_key" ON "public"."QuantityDiscount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "QuantityDiscountTier_discountId_minQty_key" ON "public"."QuantityDiscountTier"("discountId", "minQty");

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_quantityDiscountId_fkey" FOREIGN KEY ("quantityDiscountId") REFERENCES "public"."QuantityDiscount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductColor" ADD CONSTRAINT "ProductColor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductSize" ADD CONSTRAINT "ProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."ProductColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."ProductSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewImage" ADD CONSTRAINT "ViewImage_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "public"."ProductView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewImage" ADD CONSTRAINT "ViewImage_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."ProductColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationArea" ADD CONSTRAINT "DecorationArea_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "public"."ProductView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTypeDecoration" ADD CONSTRAINT "ProductTypeDecoration_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductTypeDecoration" ADD CONSTRAINT "ProductTypeDecoration_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "public"."DecorationMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductDecorationRule" ADD CONSTRAINT "ProductDecorationRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductDecorationRule" ADD CONSTRAINT "ProductDecorationRule_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "public"."DecorationMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceTable" ADD CONSTRAINT "DecorationPriceTable_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "public"."DecorationMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceTable" ADD CONSTRAINT "DecorationPriceTable_pricingGroupId_fkey" FOREIGN KEY ("pricingGroupId") REFERENCES "public"."PricingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecorationPriceCell" ADD CONSTRAINT "DecorationPriceCell_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "public"."DecorationPriceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarkupTier" ADD CONSTRAINT "MarkupTier_pricingGroupId_fkey" FOREIGN KEY ("pricingGroupId") REFERENCES "public"."PricingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuantityDiscountTier" ADD CONSTRAINT "QuantityDiscountTier_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "public"."QuantityDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
