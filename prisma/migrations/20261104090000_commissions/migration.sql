-- CreateEnum
CREATE TYPE "public"."CommissionKind" AS ENUM ('PERCENT', 'PER_PIECE');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "commission" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "commissionKind" "public"."CommissionKind",
ADD COLUMN     "commissionValue" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "public"."CommissionPayout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionPayout_storeId_idx" ON "public"."CommissionPayout"("storeId");

-- AddForeignKey
ALTER TABLE "public"."CommissionPayout" ADD CONSTRAINT "CommissionPayout_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommissionPayout" ADD CONSTRAINT "CommissionPayout_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommissionPayout" ADD CONSTRAINT "CommissionPayout_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

