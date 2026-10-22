-- Tag existing businesses' default statuses so production, purchasing and
-- shipping move orders along. Matches the default names; renamed statuses
-- are left for admins to tag in Order statuses.
UPDATE "OrderStatus" s SET "role" = r."role"
FROM (VALUES
  ('Ordering blanks', 'ORDER_BLANKS_ORDERED'::"StatusRole"),
  ('In production', 'ORDER_IN_PRODUCTION'::"StatusRole"),
  ('Ready for pickup / shipping', 'ORDER_READY'::"StatusRole"),
  ('Completed', 'ORDER_FULFILLED'::"StatusRole")
) AS r("name", "role")
WHERE s."type" = 'ORDER' AND s."name" = r."name" AND s."role" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "OrderStatus" o WHERE o."businessId" = s."businessId" AND o."role" = r."role");

-- Starter delivery methods for businesses that have none.
INSERT INTO "DeliveryMethod" ("id", "businessId", "name", "kind", "price", "sortOrder")
SELECT 'dm_' || replace(gen_random_uuid()::text, '-', ''), b."id", d."name", d."kind"::"DeliveryKind", 0, d."sortOrder"
FROM "Business" b
CROSS JOIN (VALUES ('Pickup at our shop', 'PICKUP', 0), ('Ship to you', 'SHIP', 1)) AS d("name", "kind", "sortOrder")
WHERE NOT EXISTS (SELECT 1 FROM "DeliveryMethod" m WHERE m."businessId" = b."id");
