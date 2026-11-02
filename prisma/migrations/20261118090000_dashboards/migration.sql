-- AlterTable
ALTER TABLE "public"."StaffUser" ADD COLUMN     "dashboardId" TEXT,
ADD COLUMN     "dashboardLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."DashboardLayout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widgets" JSONB NOT NULL,
    "ownerId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardLayout_businessId_ownerId_idx" ON "public"."DashboardLayout"("businessId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardLayout_businessId_id_key" ON "public"."DashboardLayout"("businessId", "id");

-- AddForeignKey
ALTER TABLE "public"."StaffUser" ADD CONSTRAINT "StaffUser_businessId_dashboardId_fkey" FOREIGN KEY ("businessId", "dashboardId") REFERENCES "public"."DashboardLayout"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardLayout" ADD CONSTRAINT "DashboardLayout_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardLayout" ADD CONSTRAINT "DashboardLayout_businessId_ownerId_fkey" FOREIGN KEY ("businessId", "ownerId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

