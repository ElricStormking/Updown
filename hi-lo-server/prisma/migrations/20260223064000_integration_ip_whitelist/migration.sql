-- AlterTable: merchant integration API caller IP whitelist
ALTER TABLE "Merchant"
ADD COLUMN "integrationAllowedIps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
