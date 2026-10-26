-- CreateTable
CREATE TABLE "public"."StoreVisitDay" (
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StoreVisitDay_pkey" PRIMARY KEY ("storeId","day")
);

-- AddForeignKey
ALTER TABLE "public"."StoreVisitDay" ADD CONSTRAINT "StoreVisitDay_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreVisitDay" ADD CONSTRAINT "StoreVisitDay_businessId_storeId_fkey" FOREIGN KEY ("businessId", "storeId") REFERENCES "public"."Store"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

