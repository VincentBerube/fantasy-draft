/*
  Warnings:

  - You are about to drop the `Note` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Player` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlayerTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tier` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Note" DROP CONSTRAINT "Note_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Player" DROP CONSTRAINT "Player_tierId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerTag" DROP CONSTRAINT "PlayerTag_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerTag" DROP CONSTRAINT "PlayerTag_tagId_fkey";

-- DropTable
DROP TABLE "public"."Note";

-- DropTable
DROP TABLE "public"."Player";

-- DropTable
DROP TABLE "public"."PlayerTag";

-- DropTable
DROP TABLE "public"."Tag";

-- DropTable
DROP TABLE "public"."Tier";

-- CreateTable
CREATE TABLE "public"."players" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "team" TEXT,
    "rank" INTEGER,
    "customRank" INTEGER,
    "projectedPoints" DOUBLE PRECISION,
    "vorp" DOUBLE PRECISION,
    "adp" DOUBLE PRECISION,
    "byeWeek" INTEGER,
    "sleeperId" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'sleeper',
    "lastSyncAt" TIMESTAMP(3),
    "isDrafted" BOOLEAN NOT NULL DEFAULT false,
    "tierId" TEXT,
    "aliases" TEXT[],
    "depthChartPosition" TEXT,
    "depthChartOrder" INTEGER,
    "importSessionId" TEXT,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_sessions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "summary" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "rolledBack" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."player_tags" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "player_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#yellow',
    "playerId" TEXT NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_sleeperId_key" ON "public"."players"("sleeperId");

-- CreateIndex
CREATE UNIQUE INDEX "tiers_name_key" ON "public"."tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tiers_order_key" ON "public"."tiers"("order");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "public"."tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "player_tags_playerId_tagId_key" ON "public"."player_tags"("playerId", "tagId");

-- AddForeignKey
ALTER TABLE "public"."players" ADD CONSTRAINT "players_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "public"."tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_tags" ADD CONSTRAINT "player_tags_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_tags" ADD CONSTRAINT "player_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
