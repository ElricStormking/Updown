-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ENABLED', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('TRANSFER_IN', 'TRANSFER_OUT', 'BET', 'CANCEL', 'PAYOUT', 'BONUS');

-- DropIndex
DROP INDEX "idx_game_config_updated";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ENABLED';

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" "AdminAccountStatus" NOT NULL DEFAULT 'ENABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLoginRecord" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "result" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "referenceId" TEXT,
    "balanceBefore" DECIMAL(18,6) NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "balanceAfter" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerLogin" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_account_key" ON "AdminAccount"("account");

-- CreateIndex
CREATE INDEX "idx_admin_login_admin_time" ON "AdminLoginRecord"("adminId", "loginTime");

-- CreateIndex
CREATE INDEX "idx_wallet_tx_user_created" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_wallet_tx_merchant_created" ON "WalletTransaction"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_player_login_merchant_time" ON "PlayerLogin"("merchantId", "loginTime");

-- CreateIndex
CREATE INDEX "idx_player_login_user_time" ON "PlayerLogin"("userId", "loginTime");

-- AddForeignKey
ALTER TABLE "AdminLoginRecord" ADD CONSTRAINT "AdminLoginRecord_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerLogin" ADD CONSTRAINT "PlayerLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
