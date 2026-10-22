-- Give existing businesses' default statuses their roles, so customer
-- responses move quotes/orders automatically. Matches the default names;
-- renamed or removed statuses are left for admins to tag.
UPDATE "OrderStatus" s SET "role" = 'QUOTE_SENT'
  WHERE s."type" = 'QUOTE' AND s."name" = 'Sent' AND s."role" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "OrderStatus" o WHERE o."businessId" = s."businessId" AND o."role" = 'QUOTE_SENT');
UPDATE "OrderStatus" s SET "role" = 'QUOTE_APPROVED'
  WHERE s."type" = 'QUOTE' AND s."name" = 'Approved' AND s."role" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "OrderStatus" o WHERE o."businessId" = s."businessId" AND o."role" = 'QUOTE_APPROVED');
UPDATE "OrderStatus" s SET "role" = 'ORDER_ARTWORK_APPROVED'
  WHERE s."type" = 'ORDER' AND s."name" = 'Artwork approved' AND s."role" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "OrderStatus" o WHERE o."businessId" = s."businessId" AND o."role" = 'ORDER_ARTWORK_APPROVED');
UPDATE "OrderStatus" s SET "role" = 'ORDER_PROOF_SENT', "name" = 'Awaiting artwork approval'
  WHERE s."type" = 'ORDER' AND s."name" = 'Awaiting artwork' AND s."role" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "OrderStatus" o WHERE o."businessId" = s."businessId" AND o."role" = 'ORDER_PROOF_SENT');
