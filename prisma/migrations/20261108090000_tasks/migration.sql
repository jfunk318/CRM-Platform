-- AlterTable
ALTER TABLE "public"."Business" ADD COLUMN     "quoteFollowUpDays" INTEGER DEFAULT 5;

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATE,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "orderId" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "autoKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_businessId_assigneeId_doneAt_idx" ON "public"."Task"("businessId", "assigneeId", "doneAt");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "public"."Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_customerId_idx" ON "public"."Task"("customerId");

-- CreateIndex
CREATE INDEX "Task_orderId_idx" ON "public"."Task"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_businessId_autoKey_key" ON "public"."Task"("businessId", "autoKey");

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_businessId_assigneeId_fkey" FOREIGN KEY ("businessId", "assigneeId") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_businessId_createdById_fkey" FOREIGN KEY ("businessId", "createdById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_businessId_leadId_fkey" FOREIGN KEY ("businessId", "leadId") REFERENCES "public"."Lead"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "public"."Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_businessId_orderId_fkey" FOREIGN KEY ("businessId", "orderId") REFERENCES "public"."Order"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_businessId_doneById_fkey" FOREIGN KEY ("businessId", "doneById") REFERENCES "public"."StaffUser"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

