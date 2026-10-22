-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."BlankSource" AS ENUM ('PO', 'STOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."StockReason" AS ENUM ('RECEIVED', 'ADJUSTED', 'USED', 'RETURNED');

-- CreateEnum
CREATE TYPE "public"."DeliveryKind" AS ENUM ('SHIP', 'PICKUP', 'DELIVERY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."StatusRole" ADD VALUE 'ORDER_BLANKS_ORDERED';
ALTER TYPE "public"."StatusRole" ADD VALUE 'ORDER_IN_PRODUCTION';
ALTER TYPE "public"."StatusRole" ADD VALUE 'ORDER_READY';
ALTER TYPE "public"."StatusRole" ADD VALUE 'ORDER_FULFILLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."OrderEventType" ADD VALUE 'PRODUCTION';
ALTER TYPE "public"."OrderEventType" ADD VALUE 'PURCHASING';
ALTER TYPE "public"."OrderEventType" ADD VALUE 'SHIPMENT';

-- AlterTable
ALTER TABLE "public"."Supplier" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "reorderPoint" INTEGER;

-- AlterTable
ALTER TABLE "public"."DecorationMethod" ADD COLUMN     "dailyCapacity" INTEGER;

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "deliveryMethodId" TEXT,
ADD COLUMN     "readyNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."EmailMessage" ADD COLUMN     "purchaseOrderId" TEXT;

-- CreateTable
CREATE TABLE "public"."WorkflowStep" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" DATE,
    "assignedToId" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionJobStep" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,

    CONSTRAINT "ProductionJobStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "shipToName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipRegion" TEXT,
    "shipPostalCode" TEXT,
    "shipCountry" TEXT NOT NULL DEFAULT 'US',
    "blindShip" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "expectedAt" DATE,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlankAllocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "source" "public"."BlankSource" NOT NULL,
    "poLineId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlankAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "reason" "public"."StockReason" NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "purchaseOrderId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryMethod" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."DeliveryKind" NOT NULL DEFAULT 'SHIP',
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "freeOver" DECIMAL(10,2),
    "carrier" TEXT,
    "service" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Shipment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "public"."DeliveryKind" NOT NULL,
    "deliveryMethodId" TEXT,
    "methodName" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "cost" DECIMAL(10,2),
    "note" TEXT,
    "shippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShipmentItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "lineId" TEXT,
    "sizeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_businessId_id_key" ON "public"."WorkflowStep"("businessId", "id");

-- CreateIndex
CREATE INDEX "ProductionJob_businessId_status_scheduledFor_idx" ON "public"."ProductionJob"("businessId", "status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJob_businessId_id_key" ON "public"."ProductionJob"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJob_orderId_methodId_key" ON "public"."ProductionJob"("orderId", "methodId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJobStep_businessId_id_key" ON "public"."ProductionJobStep"("businessId", "id");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_status_idx" ON "public"."PurchaseOrder"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_businessId_id_key" ON "public"."PurchaseOrder"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_businessId_number_key" ON "public"."PurchaseOrder"("businessId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_businessId_id_key" ON "public"."PurchaseOrderLine"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_variantId_key" ON "public"."PurchaseOrderLine"("purchaseOrderId", "variantId");

-- CreateIndex
CREATE INDEX "BlankAllocation_businessId_orderId_idx" ON "public"."BlankAllocation"("businessId", "orderId");

-- CreateIndex
CREATE INDEX "BlankAllocation_businessId_variantId_idx" ON "public"."BlankAllocation"("businessId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "BlankAllocation_businessId_id_key" ON "public"."BlankAllocation"("businessId", "id");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_variantId_idx" ON "public"."StockMovement"("businessId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryMethod_businessId_id_key" ON "public"."DeliveryMethod"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryMethod_businessId_name_key" ON "public"."DeliveryMethod"("businessId", "name");

-- CreateIndex
CREATE INDEX "Shipment_businessId_orderId_idx" ON "public"."Shipment"("businessId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_businessId_id_key" ON "public"."Shipment"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_businessId_id_key" ON "public"."ProductVariant"("businessId", "id");

-- CreateIndex
CREATE INDEX "EmailMessage_businessId_purchaseOrderId_idx" ON "public"."EmailMessage"("businessId", "purchaseOrderId");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_businessId_deliveryMethodId_fkey" FOREIGN KEY ("businessId", "deliveryMethodId") REFERENCES "public"."DeliveryMethod"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailMessage" ADD CONSTRAINT "EmailMessage_businessId_purchaseOrderId_fkey" FOREIGN KEY ("businessId", "purchaseOrderId") REFERENCES "public"."PurchaseOrder"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowStep" ADD CONSTRAINT "WorkflowStep_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowStep" ADD CONSTRAINT "WorkflowStep_businessId_methodId_fkey" FOREIGN KEY ("businessId", "methodId") REFERENCES "public"."DecorationMethod"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionJob" ADD CONSTRAINT "ProductionJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionJob" ADD CONSTRAINT "ProductionJob_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionJob" ADD CONSTRAINT "ProductionJob_businessId_methodId_fkey" FOREIGN KEY ("businessId", "methodId") REFERENCES "public"."DecorationMethod"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionJob" ADD CONSTRAINT "ProductionJob_businessId_assignedToId_fkey" FOREIGN KEY ("businessId", "assignedToId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionJobStep" ADD CONSTRAINT "ProductionJobStep_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionJobStep" ADD CONSTRAINT "ProductionJobStep_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "public"."ProductionJob"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionJobStep" ADD CONSTRAINT "ProductionJobStep_businessId_doneById_fkey" FOREIGN KEY ("businessId", "doneById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_businessId_supplierId_fkey" FOREIGN KEY ("businessId", "supplierId") REFERENCES "public"."Supplier"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_businessId_purchaseOrderId_fkey" FOREIGN KEY ("businessId", "purchaseOrderId") REFERENCES "public"."PurchaseOrder"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_businessId_variantId_fkey" FOREIGN KEY ("businessId", "variantId") REFERENCES "public"."ProductVariant"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlankAllocation" ADD CONSTRAINT "BlankAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlankAllocation" ADD CONSTRAINT "BlankAllocation_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlankAllocation" ADD CONSTRAINT "BlankAllocation_businessId_variantId_fkey" FOREIGN KEY ("businessId", "variantId") REFERENCES "public"."ProductVariant"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlankAllocation" ADD CONSTRAINT "BlankAllocation_businessId_poLineId_fkey" FOREIGN KEY ("businessId", "poLineId") REFERENCES "public"."PurchaseOrderLine"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_businessId_variantId_fkey" FOREIGN KEY ("businessId", "variantId") REFERENCES "public"."ProductVariant"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_businessId_purchaseOrderId_fkey" FOREIGN KEY ("businessId", "purchaseOrderId") REFERENCES "public"."PurchaseOrder"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_businessId_staffId_fkey" FOREIGN KEY ("businessId", "staffId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryMethod" ADD CONSTRAINT "DeliveryMethod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_businessId_deliveryMethodId_fkey" FOREIGN KEY ("businessId", "deliveryMethodId") REFERENCES "public"."DeliveryMethod"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentItem" ADD CONSTRAINT "ShipmentItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentItem" ADD CONSTRAINT "ShipmentItem_businessId_shipmentId_fkey" FOREIGN KEY ("businessId", "shipmentId") REFERENCES "public"."Shipment"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentItem" ADD CONSTRAINT "ShipmentItem_businessId_lineId_fkey" FOREIGN KEY ("businessId", "lineId") REFERENCES "public"."OrderLine"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

