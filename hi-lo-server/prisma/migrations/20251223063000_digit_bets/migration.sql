-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('HILO', 'DIGIT');

-- CreateEnum
CREATE TYPE "DigitBetType" AS ENUM ('SMALL', 'BIG', 'ODD', 'EVEN', 'ANY_TRIPLE', 'DOUBLE', 'TRIPLE', 'SUM', 'SINGLE');

-- AlterTable
ALTER TABLE "Bet"
ADD COLUMN "betType" "BetType" NOT NULL DEFAULT 'HILO',
ADD COLUMN "digitType" "DigitBetType",
ADD COLUMN "selection" TEXT;

-- AlterTable
ALTER TABLE "Bet" ALTER COLUMN "side" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Round"
ADD COLUMN "digitResult" TEXT,
ADD COLUMN "digitSum" INTEGER;
