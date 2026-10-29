-- AlterTable
ALTER TABLE "public"."DecorationArea" ADD COLUMN     "autoPlaced" BOOLEAN NOT NULL DEFAULT false;


-- Areas still at the importer's positions count as auto-placed.
UPDATE "DecorationArea" SET "autoPlaced" = true
WHERE (name = 'Full Front' AND x = 0.383 AND y = 0.32 AND w = 0.24 AND h = 0.28)
   OR (name = 'Left Chest' AND x = 0.542 AND y = 0.33 AND w = 0.08 AND h = 0.08)
   OR (name = 'Right Chest' AND x = 0.389 AND y = 0.33 AND w = 0.08 AND h = 0.08)
   OR (name = 'Full Back' AND x = 0.383 AND y = 0.29 AND w = 0.24 AND h = 0.28)
   OR (name = 'Front Panel' AND x = 0.3 AND y = 0.3 AND w = 0.4 AND h = 0.2)
   OR (name = 'Back Arch' AND x = 0.35 AND y = 0.45 AND w = 0.3 AND h = 0.1)
   OR (name = 'Front' AND x = 0.25 AND y = 0.3 AND w = 0.5 AND h = 0.4);
