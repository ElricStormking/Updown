-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "visibleId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "balanceAfter" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "merchantId" TEXT;
ALTER TABLE "User" ADD COLUMN "merchantAccount" TEXT;

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN "merchantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_merchantId_key" ON "Merchant"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_visibleId_key" ON "Transfer"("visibleId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_merchantId_orderNo_key" ON "Transfer"("merchantId", "orderNo");

-- CreateIndex
CREATE INDEX "idx_transfer_merchant_created" ON "Transfer"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_merchantId_merchantAccount_key" ON "User"("merchantId", "merchantAccount");

-- CreateIndex
CREATE INDEX "idx_bet_merchant_created" ON "Bet"("merchantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("merchantId") ON DELETE SET NULL ON UPDATE CASCADE;
