-- AlterTable
ALTER TABLE "public"."Store" ADD COLUMN     "heroButton" TEXT,
ADD COLUMN     "heroHeadline" TEXT,
ADD COLUMN     "heroImageFileId" TEXT,
ADD COLUMN     "heroText" TEXT,
ADD COLUMN     "showHero" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'minimal';

-- AddForeignKey
ALTER TABLE "public"."Store" ADD CONSTRAINT "Store_businessId_heroImageFileId_fkey" FOREIGN KEY ("businessId", "heroImageFileId") REFERENCES "public"."StoredFile"("businessId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- The banner now shows the store's name, so drop the stock welcome text new
-- stores were given (pages someone has edited are left alone). The main site
-- keeps its own heading, so its banner starts off.
UPDATE "public"."StorePage" p SET "body" = ''
FROM "public"."Store" s
WHERE p."storeId" = s."id" AND p."slug" = 'home'
  AND p."body" = '# ' || s."name" || E'\n\nWelcome to the ' || s."name" || ' store. Pick your gear below.';
UPDATE "public"."Store" SET "showHero" = false WHERE "kind" = 'ROOT';
