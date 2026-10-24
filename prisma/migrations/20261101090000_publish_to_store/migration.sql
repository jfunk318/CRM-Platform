-- AlterEnum
ALTER TYPE "public"."OrderEventType" ADD VALUE 'STORE';

-- AlterTable
ALTER TABLE "public"."StoreItem" ADD COLUMN     "imageIsMockup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceLineId" TEXT;

-- CreateIndex
CREATE INDEX "StoreItem_storeId_sourceLineId_idx" ON "public"."StoreItem"("storeId", "sourceLineId");

