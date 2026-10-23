-- CreateEnum
CREATE TYPE "public"."CatalogImportStatus" AS ENUM ('READY', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "public"."CatalogImport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "public"."CatalogImportStatus" NOT NULL DEFAULT 'READY',
    "summary" JSONB NOT NULL,
    "options" JSONB,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogImport_businessId_id_key" ON "public"."CatalogImport"("businessId", "id");

-- AddForeignKey
ALTER TABLE "public"."CatalogImport" ADD CONSTRAINT "CatalogImport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogImport" ADD CONSTRAINT "CatalogImport_businessId_supplierId_fkey" FOREIGN KEY ("businessId", "supplierId") REFERENCES "public"."Supplier"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogImport" ADD CONSTRAINT "CatalogImport_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

