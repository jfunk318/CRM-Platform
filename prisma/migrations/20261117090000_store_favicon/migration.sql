-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "faviconFileId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_faviconFileId_fkey" FOREIGN KEY ("businessId", "faviconFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

