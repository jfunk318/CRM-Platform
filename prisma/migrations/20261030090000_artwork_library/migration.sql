-- CreateTable
CREATE TABLE "public"."ArtworkAsset" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "customerId" TEXT,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtworkAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtworkAsset_businessId_customerId_idx" ON "public"."ArtworkAsset"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "ArtworkAsset_businessId_companyId_idx" ON "public"."ArtworkAsset"("businessId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkAsset_businessId_fileId_key" ON "public"."ArtworkAsset"("businessId", "fileId");

-- AddForeignKey
ALTER TABLE "public"."ArtworkAsset" ADD CONSTRAINT "ArtworkAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArtworkAsset" ADD CONSTRAINT "ArtworkAsset_businessId_fileId_fkey" FOREIGN KEY ("businessId", "fileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArtworkAsset" ADD CONSTRAINT "ArtworkAsset_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArtworkAsset" ADD CONSTRAINT "ArtworkAsset_businessId_companyId_fkey" FOREIGN KEY ("businessId", "companyId") REFERENCES "public"."Company"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Start each customer's library with the images already uploaded to their
-- quotes and orders (artwork and customer files that can be placed).
INSERT INTO "public"."ArtworkAsset" ("id", "businessId", "fileId", "customerId", "companyId", "name", "createdAt")
SELECT DISTINCT ON (f."id")
  'art' || md5(random()::text || f."id"), f."businessId", f."id", o."customerId", COALESCE(o."companyId", c."companyId"), f."name", f."createdAt"
FROM "public"."OrderFile" link
JOIN "public"."StoredFile" f ON f."id" = link."fileId"
JOIN "public"."Order" o ON o."id" = link."orderId"
JOIN "public"."Customer" c ON c."id" = o."customerId"
WHERE link."kind" IN ('ARTWORK', 'CUSTOMER') AND lower(f."name") ~ '\.(png|jpe?g|gif|webp|svg)$'
ORDER BY f."id", link."createdAt";
