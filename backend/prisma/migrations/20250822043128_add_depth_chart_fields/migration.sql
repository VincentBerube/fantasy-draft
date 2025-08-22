-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "depthChartOrder" INTEGER,
ADD COLUMN     "depthChartPosition" INTEGER;

-- CreateIndex
CREATE INDEX "Player_depthChartPosition_idx" ON "public"."Player"("depthChartPosition");
