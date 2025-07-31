/*
  Warnings:

  - You are about to drop the column `tier` on the `Player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "tier",
ADD COLUMN     "tierId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "public"."Tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
