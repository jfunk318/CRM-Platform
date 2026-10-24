-- AlterEnum
ALTER TYPE "public"."OrderSource" ADD VALUE 'STORE_BATCH';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "heldForBatch" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "batchOrders" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."StoreBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreBatch_businessId_id_key" ON "public"."StoreBatch"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBatch_businessId_orderId_key" ON "public"."StoreBatch"("businessId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBatch_storeId_number_key" ON "public"."StoreBatch"("storeId", "number");

-- CreateIndex
CREATE INDEX "Order_storeId_heldForBatch_idx" ON "public"."Order"("storeId", "heldForBatch");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_batchId_fkey" FOREIGN KEY ("businessId", "batchId") REFERENCES "public"."StoreBatch"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreBatch" ADD CONSTRAINT "StoreBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreBatch" ADD CONSTRAINT "StoreBatch_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreBatch" ADD CONSTRAINT "StoreBatch_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreBatch" ADD CONSTRAINT "StoreBatch_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

