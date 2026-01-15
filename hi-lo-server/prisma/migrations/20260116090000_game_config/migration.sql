-- AlterTable
ALTER TABLE "Round" ADD COLUMN "gameConfigSnapshot" JSONB;

-- CreateTable
CREATE TABLE "GameConfig" (
    "id" SERIAL NOT NULL,
    "bettingDurationMs" INTEGER NOT NULL,
    "resultDurationMs" INTEGER NOT NULL,
    "resultDisplayDurationMs" INTEGER NOT NULL,
    "minBetAmount" DECIMAL(18,6) NOT NULL,
    "maxBetAmount" DECIMAL(18,6) NOT NULL,
    "payoutMultiplierUp" DECIMAL(6,3) NOT NULL,
    "payoutMultiplierDown" DECIMAL(6,3) NOT NULL,
    "priceSnapshotInterval" INTEGER NOT NULL,
    "digitPayouts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_game_config_updated" ON "GameConfig"("updatedAt");
