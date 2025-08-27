-- AlterTable
ALTER TABLE "public"."notes" ALTER COLUMN "color" SET DEFAULT '#6B7280';

-- AlterTable
ALTER TABLE "public"."players" ADD COLUMN     "lastSeasonPoints" DOUBLE PRECISION,
ADD COLUMN     "positionalRank" TEXT;
