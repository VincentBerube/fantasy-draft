-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "positionalRank" TEXT NOT NULL,
    "adp" DOUBLE PRECISION NOT NULL,
    "vorp" DOUBLE PRECISION NOT NULL,
    "projectedPoints" DOUBLE PRECISION NOT NULL,
    "lastSeasonPoints" DOUBLE PRECISION NOT NULL,
    "byeWeek" INTEGER NOT NULL,
    "userNotes" TEXT[],
    "customTags" TEXT[],

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_position_key" ON "Player"("name", "position");
