-- CreateEnum
CREATE TYPE "public"."StoreRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'DECLINED');

-- DropIndex
DROP INDEX "public"."Order_businessId_invoiceNumber_key";

-- AlterTable
ALTER TABLE "public"."Business" ADD COLUMN     "slackWebhookEnc" TEXT;

-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "portalSections" TEXT[] DEFAULT ARRAY['sales', 'orders', 'codes', 'commission', 'requests']::TEXT[],
ADD COLUMN     "requestQuotes" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."StoreContact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT,
    "canManage" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "public"."StoreRequestStatus" NOT NULL DEFAULT 'NEW',
    "seenAt" TIMESTAMP(3),
    "reply" TEXT,
    "quoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreContact_storeId_customerId_key" ON "public"."StoreContact"("storeId", "customerId");

-- CreateIndex
CREATE INDEX "StoreRequest_businessId_seenAt_idx" ON "public"."StoreRequest"("businessId", "seenAt");

-- CreateIndex
CREATE INDEX "StoreRequest_storeId_createdAt_idx" ON "public"."StoreRequest"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."StoreContact" ADD CONSTRAINT "StoreContact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreContact" ADD CONSTRAINT "StoreContact_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreContact" ADD CONSTRAINT "StoreContact_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreRequest" ADD CONSTRAINT "StoreRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreRequest" ADD CONSTRAINT "StoreRequest_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreRequest" ADD CONSTRAINT "StoreRequest_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreRequest" ADD CONSTRAINT "StoreRequest_businessId_quoteId_fkey" FOREIGN KEY ("businessId", "quoteId") REFERENCES "public"."Order"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

