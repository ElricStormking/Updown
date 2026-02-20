-- AlterTable: extend Merchant settings for callback-mode integration
ALTER TABLE "Merchant"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USDT',
ADD COLUMN "callbackEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "loginPlayerCallbackUrl" TEXT,
ADD COLUMN "updateBalanceCallbackUrl" TEXT;

-- CreateEnum
CREATE TYPE "LaunchSessionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LaunchSessionLoginStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "LaunchSessionOfflineStatus" AS ENUM ('ONLINE', 'OFFLINE_PENDING', 'CALLBACK_SENT', 'CALLBACK_FAILED', 'SETTLED');

-- CreateTable
CREATE TABLE "MerchantLaunchSession" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "merchantAccessToken" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "LaunchSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "loginStatus" "LaunchSessionLoginStatus" NOT NULL DEFAULT 'PENDING',
    "offlineStatus" "LaunchSessionOfflineStatus" NOT NULL DEFAULT 'ONLINE',
    "loginVerifiedAt" TIMESTAMP(3),
    "updateBalanceSentAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantLaunchSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_launch_session_merchant_user_status" ON "MerchantLaunchSession"("merchantId", "userId", "status");

-- CreateIndex
CREATE INDEX "idx_launch_session_expires" ON "MerchantLaunchSession"("expiresAt");

-- CreateIndex
CREATE INDEX "idx_launch_session_status_offline" ON "MerchantLaunchSession"("status", "offlineStatus");

-- AddForeignKey
ALTER TABLE "MerchantLaunchSession" ADD CONSTRAINT "MerchantLaunchSession_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantLaunchSession" ADD CONSTRAINT "MerchantLaunchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
