-- CreateEnum
CREATE TYPE "public"."StatusRole" AS ENUM ('QUOTE_SENT', 'QUOTE_APPROVED', 'QUOTE_CHANGES_REQUESTED', 'QUOTE_CONVERTED', 'ORDER_PROOF_SENT', 'ORDER_ARTWORK_APPROVED', 'ORDER_CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "public"."OrderFileKind" AS ENUM ('ARTWORK', 'PRODUCTION', 'MOCKUP', 'CUSTOMER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ProofStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'CHANGES_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CHECK', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('SENT', 'FAILED', 'LOGGED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."OrderEventType" ADD VALUE 'EMAIL';
ALTER TYPE "public"."OrderEventType" ADD VALUE 'CUSTOMER';
ALTER TYPE "public"."OrderEventType" ADD VALUE 'FILE';
ALTER TYPE "public"."OrderEventType" ADD VALUE 'PROOF';
ALTER TYPE "public"."OrderEventType" ADD VALUE 'PAYMENT';
ALTER TYPE "public"."OrderEventType" ADD VALUE 'INVOICE';

-- AlterTable
ALTER TABLE "public"."Business" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN     "defaultDepositPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "invoiceTerms" TEXT,
ADD COLUMN     "paymentInstructions" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "public"."OrderStatus" ADD COLUMN     "role" "public"."StatusRole";

-- Carry the old "became an order" flag over to its status role, then drop it.
UPDATE "public"."OrderStatus" SET "role" = 'QUOTE_CONVERTED' WHERE "isConversion" = true;
ALTER TABLE "public"."OrderStatus" DROP COLUMN "isConversion";

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByName" TEXT,
ADD COLUMN     "depositRequired" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceDueDate" DATE,
ADD COLUMN     "invoiceNumber" INTEGER,
ADD COLUMN     "invoicedAt" TIMESTAMP(3),
ADD COLUMN     "paidTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "publicToken" TEXT;

-- CreateTable
CREATE TABLE "public"."StoredFile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderFile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "kind" "public"."OrderFileKind" NOT NULL DEFAULT 'ARTWORK',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Proof" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "status" "public"."ProofStatus" NOT NULL DEFAULT 'DRAFT',
    "message" TEXT,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "responderName" TEXT,
    "responseNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProofFile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fromCustomer" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProofFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "public"."EmailStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "public"."StoredFile"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_businessId_id_key" ON "public"."StoredFile"("businessId", "id");

-- CreateIndex
CREATE INDEX "OrderFile_businessId_orderId_idx" ON "public"."OrderFile"("businessId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderFile_orderId_fileId_key" ON "public"."OrderFile"("orderId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_token_key" ON "public"."Proof"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_businessId_id_key" ON "public"."Proof"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_orderId_number_key" ON "public"."Proof"("orderId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProofFile_proofId_fileId_key" ON "public"."ProofFile"("proofId", "fileId");

-- CreateIndex
CREATE INDEX "Payment_businessId_orderId_idx" ON "public"."Payment"("businessId", "orderId");

-- CreateIndex
CREATE INDEX "EmailMessage_businessId_orderId_idx" ON "public"."EmailMessage"("businessId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatus_businessId_role_key" ON "public"."OrderStatus"("businessId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "public"."Order"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_invoiceNumber_key" ON "public"."Order"("businessId", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "public"."StoredFile" ADD CONSTRAINT "StoredFile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoredFile" ADD CONSTRAINT "StoredFile_businessId_uploadedById_fkey" FOREIGN KEY ("businessId", "uploadedById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderFile" ADD CONSTRAINT "OrderFile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderFile" ADD CONSTRAINT "OrderFile_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderFile" ADD CONSTRAINT "OrderFile_businessId_fileId_fkey" FOREIGN KEY ("businessId", "fileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proof" ADD CONSTRAINT "Proof_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proof" ADD CONSTRAINT "Proof_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proof" ADD CONSTRAINT "Proof_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProofFile" ADD CONSTRAINT "ProofFile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProofFile" ADD CONSTRAINT "ProofFile_businessId_proofId_fkey" FOREIGN KEY ("businessId", "proofId") REFERENCES "public"."Proof"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProofFile" ADD CONSTRAINT "ProofFile_businessId_fileId_fkey" FOREIGN KEY ("businessId", "fileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_businessId_staffId_fkey" FOREIGN KEY ("businessId", "staffId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailMessage" ADD CONSTRAINT "EmailMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailMessage" ADD CONSTRAINT "EmailMessage_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

