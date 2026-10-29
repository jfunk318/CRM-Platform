-- AlterTable
ALTER TABLE "public"."DecorationMethod" ADD COLUMN     "shopperDesign" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "designerAnyGarment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "designerEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "designerLibrary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designerMethodIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "designerText" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designerUpload" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."CartItem" ADD COLUMN     "designId" TEXT,
ADD COLUMN     "imageFileId" TEXT,
ALTER COLUMN "storeItemId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."CartFile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CartFile_cartId_fileId_key" ON "public"."CartFile"("cartId", "fileId");

-- AddForeignKey
ALTER TABLE "public"."CartFile" ADD CONSTRAINT "CartFile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartFile" ADD CONSTRAINT "CartFile_businessId_cartId_fkey" FOREIGN KEY ("businessId", "cartId") REFERENCES "public"."Cart"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartFile" ADD CONSTRAINT "CartFile_businessId_fileId_fkey" FOREIGN KEY ("businessId", "fileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_businessId_designId_fkey" FOREIGN KEY ("businessId", "designId") REFERENCES "public"."Design"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_businessId_imageFileId_fkey" FOREIGN KEY ("businessId", "imageFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

