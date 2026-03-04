DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "merchantId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on User.merchantId: existing NULL values found.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Bet" WHERE "merchantId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on Bet.merchantId: existing NULL values found.';
  END IF;
END
$$;

ALTER TABLE "User"
ALTER COLUMN "merchantId" SET NOT NULL;

ALTER TABLE "Bet"
ALTER COLUMN "merchantId" SET NOT NULL;
