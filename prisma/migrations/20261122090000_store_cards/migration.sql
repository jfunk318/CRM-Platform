-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "cardImageFileId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_cardImageFileId_fkey" FOREIGN KEY ("businessId", "cardImageFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

