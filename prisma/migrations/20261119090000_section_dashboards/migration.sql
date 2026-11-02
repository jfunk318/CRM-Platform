-- Dashboards per section: a layout belongs to a section, and each staff
-- member's choice (and lock) is kept per section. Existing choices become
-- their Sales dashboard.

-- AlterTable
ALTER TABLE "public"."DashboardLayout" ADD COLUMN     "section" TEXT NOT NULL DEFAULT 'sales';

-- CreateTable
CREATE TABLE "public"."StaffDashboard" (
    "businessId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "layoutId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StaffDashboard_pkey" PRIMARY KEY ("staffId","section")
);

-- AddForeignKey
ALTER TABLE "public"."StaffDashboard" ADD CONSTRAINT "StaffDashboard_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StaffDashboard" ADD CONSTRAINT "StaffDashboard_businessId_staffId_fkey" FOREIGN KEY ("businessId", "staffId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StaffDashboard" ADD CONSTRAINT "StaffDashboard_businessId_layoutId_fkey" FOREIGN KEY ("businessId", "layoutId") REFERENCES "public"."DashboardLayout"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over existing choices as Sales dashboards.
INSERT INTO "public"."StaffDashboard" ("businessId", "staffId", "section", "layoutId", "locked")
SELECT "businessId", "id", 'sales', "dashboardId", "dashboardLocked" FROM "public"."StaffUser" WHERE "dashboardId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "public"."StaffUser" DROP CONSTRAINT "StaffUser_businessId_dashboardId_fkey";

-- AlterTable
ALTER TABLE "public"."StaffUser" DROP COLUMN "dashboardId",
DROP COLUMN "dashboardLocked";
