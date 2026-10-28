-- CreateEnum
CREATE TYPE "public"."AutomationTrigger" AS ENUM ('QUOTE_CREATED', 'ORDER_CREATED', 'ONLINE_ORDER', 'STATUS_CHANGED', 'ORDER_PAID', 'PROOF_APPROVED', 'PROOF_CHANGES', 'LEAD_CREATED', 'STORE_REQUEST');

-- CreateTable
CREATE TABLE "public"."AutomationRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "public"."AutomationTrigger" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutomationEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "trigger" "public"."AutomationTrigger" NOT NULL,
    "orderId" TEXT,
    "leadId" TEXT,
    "requestId" TEXT,
    "statusId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "origin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutomationRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_businessId_trigger_active_idx" ON "public"."AutomationRule"("businessId", "trigger", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_businessId_id_key" ON "public"."AutomationRule"("businessId", "id");

-- CreateIndex
CREATE INDEX "AutomationEvent_processedAt_createdAt_idx" ON "public"."AutomationEvent"("processedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEvent_businessId_id_key" ON "public"."AutomationEvent"("businessId", "id");

-- CreateIndex
CREATE INDEX "AutomationRun_ruleId_createdAt_idx" ON "public"."AutomationRun"("ruleId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."AutomationRule" ADD CONSTRAINT "AutomationRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationEvent" ADD CONSTRAINT "AutomationEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationRun" ADD CONSTRAINT "AutomationRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationRun" ADD CONSTRAINT "AutomationRun_businessId_ruleId_fkey" FOREIGN KEY ("businessId", "ruleId") REFERENCES "public"."AutomationRule"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationRun" ADD CONSTRAINT "AutomationRun_businessId_eventId_fkey" FOREIGN KEY ("businessId", "eventId") REFERENCES "public"."AutomationEvent"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

