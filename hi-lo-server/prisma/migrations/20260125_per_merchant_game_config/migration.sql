-- AlterTable: Add merchantId to GameConfig for per-merchant configurations
ALTER TABLE "GameConfig" ADD COLUMN "merchantId" TEXT;

-- CreateIndex: Index for merchant lookup
CREATE INDEX "idx_game_config_merchant" ON "GameConfig"("merchantId");

-- CreateIndex: Unique constraint (allows only one config per merchant, null for global)
CREATE UNIQUE INDEX "GameConfig_merchantId_key" ON "GameConfig"("merchantId");

-- AddForeignKey: Reference to Merchant table
ALTER TABLE "GameConfig" ADD CONSTRAINT "GameConfig_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("merchantId") ON DELETE SET NULL ON UPDATE CASCADE;
