-- CreateEnum
CREATE TYPE "public"."LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "public"."LeadEventType" AS ENUM ('CREATED', 'NOTE', 'CALL', 'EMAIL', 'MEETING', 'STATUS', 'CONVERTED');

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "organization" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "interest" TEXT,
    "estimatedValue" DECIMAL(10,2),
    "status" "public"."LeadStatus" NOT NULL DEFAULT 'NEW',
    "lostReason" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "customerId" TEXT,
    "quoteId" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "public"."LeadEventType" NOT NULL,
    "body" TEXT NOT NULL,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_businessId_status_idx" ON "public"."Lead"("businessId", "status");

-- CreateIndex
CREATE INDEX "Lead_businessId_email_idx" ON "public"."Lead"("businessId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_businessId_id_key" ON "public"."Lead"("businessId", "id");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_createdAt_idx" ON "public"."LeadEvent"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_businessId_ownerId_fkey" FOREIGN KEY ("businessId", "ownerId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_businessId_quoteId_fkey" FOREIGN KEY ("businessId", "quoteId") REFERENCES "public"."Order"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadEvent" ADD CONSTRAINT "LeadEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadEvent" ADD CONSTRAINT "LeadEvent_businessId_leadId_fkey" FOREIGN KEY ("businessId", "leadId") REFERENCES "public"."Lead"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadEvent" ADD CONSTRAINT "LeadEvent_businessId_staffId_fkey" FOREIGN KEY ("businessId", "staffId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

