-- AlterTable
ALTER TABLE "public"."Business" ADD COLUMN     "placementGuides" JSONB;

-- AlterTable
ALTER TABLE "public"."DecorationMethod" ADD COLUMN     "stitchDensity" INTEGER NOT NULL DEFAULT 1800;

-- AlterTable
ALTER TABLE "public"."DesignDecoration" ADD COLUMN     "artCoverage" DOUBLE PRECISION,
ADD COLUMN     "stitchesSet" BOOLEAN NOT NULL DEFAULT false;

