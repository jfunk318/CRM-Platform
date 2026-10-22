-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('QUOTE', 'ORDER');

-- CreateEnum
CREATE TYPE "public"."OrderEventType" AS ENUM ('CREATED', 'NOTE', 'STATUS', 'ASSIGNED', 'EDITED', 'CONVERTED');

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "pricingGroupId" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "taxExempt" BOOLEAN,
    "pricingGroupId" TEXT,
    "companyId" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "name" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Design" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesignDecoration" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "areaId" TEXT,
    "location" TEXT NOT NULL,
    "colors" INTEGER,
    "stitches" INTEGER,
    "widthIn" DECIMAL(6,2),
    "heightIn" DECIMAL(6,2),
    "inkColors" TEXT[],
    "needsArtwork" BOOLEAN NOT NULL DEFAULT false,
    "needsDigitizing" BOOLEAN NOT NULL DEFAULT false,
    "reuseScreens" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DesignDecoration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderStatus" (
    "id" TEXT NOT NULL,
    "type" "public"."OrderType" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#9CA3AF',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "type" "public"."OrderType" NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "customerId" TEXT NOT NULL,
    "companyId" TEXT,
    "statusId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "pricingGroupId" TEXT,
    "dueDate" DATE,
    "rush" BOOLEAN NOT NULL DEFAULT false,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "customerNotes" TEXT,
    "shipName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipRegion" TEXT,
    "shipPostalCode" TEXT,
    "shipCountry" TEXT NOT NULL DEFAULT 'US',
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "merchandise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "feesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rushFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pricedAt" TIMESTAMP(3),
    "quoteId" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "designId" TEXT NOT NULL,
    "notes" TEXT,
    "decorationUnit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "fees" JSONB NOT NULL DEFAULT '[]',
    "feesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderLineSize" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLineSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "public"."OrderEventType" NOT NULL,
    "body" TEXT NOT NULL,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "public"."Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_externalSource_externalId_key" ON "public"."Company"("externalSource", "externalId");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "public"."Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_lastName_firstName_idx" ON "public"."Customer"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalSource_externalId_key" ON "public"."Customer"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatus_type_name_key" ON "public"."OrderStatus"("type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Order_quoteId_key" ON "public"."Order"("quoteId");

-- CreateIndex
CREATE INDEX "Order_statusId_idx" ON "public"."Order"("statusId");

-- CreateIndex
CREATE INDEX "Order_assignedToId_idx" ON "public"."Order"("assignedToId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "public"."Order"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_type_number_key" ON "public"."Order"("type", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_externalSource_externalId_key" ON "public"."Order"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLineSize_lineId_sizeId_key" ON "public"."OrderLineSize"("lineId", "sizeId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "public"."OrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_pricingGroupId_fkey" FOREIGN KEY ("pricingGroupId") REFERENCES "public"."PricingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_pricingGroupId_fkey" FOREIGN KEY ("pricingGroupId") REFERENCES "public"."PricingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."ProductColor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_designId_fkey" FOREIGN KEY ("designId") REFERENCES "public"."Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "public"."DecorationMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesignDecoration" ADD CONSTRAINT "DesignDecoration_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "public"."DecorationArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."OrderStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_pricingGroupId_fkey" FOREIGN KEY ("pricingGroupId") REFERENCES "public"."PricingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLine" ADD CONSTRAINT "OrderLine_designId_fkey" FOREIGN KEY ("designId") REFERENCES "public"."Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLineSize" ADD CONSTRAINT "OrderLineSize_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "public"."OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderLineSize" ADD CONSTRAINT "OrderLineSize_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "public"."ProductSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
