-- CreateTable
CREATE TABLE "public"."StaffSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "public"."StaffSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSession_userId_idx" ON "public"."StaffSession"("userId");

-- AddForeignKey
ALTER TABLE "public"."StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
