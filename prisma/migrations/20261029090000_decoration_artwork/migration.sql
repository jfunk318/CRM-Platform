-- AlterTable
ALTER TABLE "public"."DesignDecoration" ADD COLUMN     "artEdits" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "artHeightPx" INTEGER,
ADD COLUMN     "artWidthPx" INTEGER,
ADD COLUMN     "artworkFileId" TEXT,
ADD COLUMN     "placeW" DOUBLE PRECISION,
ADD COLUMN     "placeX" DOUBLE PRECISION,
ADD COLUMN     "placeY" DOUBLE PRECISION,
ADD COLUMN     "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sourceFileId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_businessId_artworkFileId_fkey" FOREIGN KEY ("businessId", "artworkFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_businessId_sourceFileId_fkey" FOREIGN KEY ("businessId", "sourceFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

