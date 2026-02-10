-- Add stored balanceBefore for transfer history responses
ALTER TABLE "Transfer"
ADD COLUMN "balanceBefore" DECIMAL(18, 6);

-- Backfill historical rows using transfer type semantics
UPDATE "Transfer"
SET "balanceBefore" = CASE
  WHEN "type" = 0 THEN "balanceAfter" - "amount"
  WHEN "type" = 1 THEN "balanceAfter" + "amount"
  ELSE "balanceAfter"
END;

ALTER TABLE "Transfer"
ALTER COLUMN "balanceBefore" SET NOT NULL;
