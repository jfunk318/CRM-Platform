-- CreateEnum
CREATE TYPE "public"."PersonalizationMode" AS ENUM ('OFF', 'OPTIONAL', 'REQUIRED');

-- DropIndex
DROP INDEX "public"."CartItem_cartId_storeItemId_sizeId_key";

-- AlterTable
ALTER TABLE "public"."StoreItem" ADD COLUMN     "nameMaxLength" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "nameMode" "public"."PersonalizationMode" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "namePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "numberMaxDigits" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "numberMode" "public"."PersonalizationMode" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "numberPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "personalizationLocation" TEXT;

-- AlterTable
ALTER TABLE "public"."CartItem" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "number" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "public"."OrderLineName" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "number" TEXT NOT NULL DEFAULT '',
    "qty" INTEGER NOT NULL DEFAULT 1,
    "charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLineName_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderLineName_lineId_idx" ON "public"."OrderLineName"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_storeItemId_sizeId_name_number_key" ON "public"."CartItem"("cartId", "storeItemId", "sizeId", "name", "number");

-- AddForeignKey
ALTER TABLE "public"."OrderLineName" ADD CONSTRAINT "OrderLineName_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLineName" ADD CONSTRAINT "OrderLineName_businessId_lineId_fkey" FOREIGN KEY ("businessId", "lineId") REFERENCES "public"."OrderLine"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLineName" ADD CONSTRAINT "OrderLineName_businessId_sizeId_fkey" FOREIGN KEY ("businessId", "sizeId") REFERENCES "public"."ProductSize"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

