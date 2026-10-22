-- Add the "changes requested" statuses to existing businesses, right after
-- the status a quote or proof is in while waiting on the customer. Skipped
-- where a business already has a status with that role or that name.
CREATE TEMP TABLE "_new_status" AS
SELECT a."businessId", a."type", n."name", n."color", n."role", a."sortOrder" + 1 AS "sortOrder"
FROM "OrderStatus" a
JOIN (VALUES
  ('QUOTE_SENT'::"StatusRole", 'Changes requested', '#F59E0B', 'QUOTE_CHANGES_REQUESTED'::"StatusRole"),
  ('ORDER_PROOF_SENT'::"StatusRole", 'Artwork changes requested', '#EF4444', 'ORDER_CHANGES_REQUESTED'::"StatusRole")
) AS n("after", "name", "color", "role") ON a."role" = n."after"
WHERE NOT EXISTS (
  SELECT 1 FROM "OrderStatus" o
  WHERE o."businessId" = a."businessId" AND (o."role" = n."role" OR (o."type" = a."type" AND o."name" = n."name"))
);

UPDATE "OrderStatus" s SET "sortOrder" = s."sortOrder" + 1
FROM "_new_status" n
WHERE s."businessId" = n."businessId" AND s."type" = n."type" AND s."sortOrder" >= n."sortOrder";

INSERT INTO "OrderStatus" ("id", "businessId", "type", "name", "color", "sortOrder", "role")
SELECT 'st_' || replace(gen_random_uuid()::text, '-', ''), "businessId", "type", "name", "color", "sortOrder", "role"
FROM "_new_status";

DROP TABLE "_new_status";
