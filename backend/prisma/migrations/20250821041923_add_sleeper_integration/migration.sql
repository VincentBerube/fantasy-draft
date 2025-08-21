-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "dataSource" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "sleeperId" TEXT;

-- CreateTable
CREATE TABLE "public"."SyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncLog_source_idx" ON "public"."SyncLog"("source");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "public"."SyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "Player_sleeperId_idx" ON "public"."Player"("sleeperId");

-- CreateIndex
CREATE INDEX "Player_dataSource_idx" ON "public"."Player"("dataSource");

-- CreateIndex
CREATE INDEX "Player_lastSyncAt_idx" ON "public"."Player"("lastSyncAt");
