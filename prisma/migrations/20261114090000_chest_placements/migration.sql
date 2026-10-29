-- Print areas on imported garments moved to life-size positions on the
-- model photos (≈2% of the frame per inch): left chest lower and smaller,
-- full front/back 12" wide instead of ~20", and a right chest added.
-- Only areas still at the old import defaults are changed.

UPDATE "DecorationArea" a SET x = 0.542, y = 0.33, w = 0.08, h = 0.08
FROM "ProductView" v
WHERE v.id = a."viewId" AND v.name = 'Front' AND a.name = 'Left Chest'
  AND a.x = 0.56 AND a.y = 0.24 AND a.w = 0.12 AND a.h = 0.12;

UPDATE "DecorationArea" a SET x = 0.383, y = 0.32, w = 0.24, h = 0.28
FROM "ProductView" v
WHERE v.id = a."viewId" AND v.name = 'Front' AND a.name = 'Full Front'
  AND a.x = 0.3 AND a.y = 0.22 AND a.w = 0.4 AND a.h = 0.45;

UPDATE "DecorationArea" a SET x = 0.383, y = 0.29, w = 0.24, h = 0.28
FROM "ProductView" v
WHERE v.id = a."viewId" AND v.name = 'Back' AND a.name = 'Full Back'
  AND a.x = 0.3 AND a.y = 0.2 AND a.w = 0.4 AND a.h = 0.45;

-- A right chest wherever there's a left chest and no right chest yet.
INSERT INTO "DecorationArea" ("id", "businessId", "viewId", "name", "widthIn", "heightIn", "x", "y", "w", "h")
SELECT 'c' || substr(md5(random()::text || a."id"), 1, 24), a."businessId", a."viewId", 'Right Chest', 4, 4, 0.389, 0.33, 0.08, 0.08
FROM "DecorationArea" a
WHERE a.name = 'Left Chest'
  AND NOT EXISTS (SELECT 1 FROM "DecorationArea" b WHERE b."viewId" = a."viewId" AND b.name = 'Right Chest');
