UPDATE "Wallet" AS w
SET "currency" = m."currency"
FROM "User" AS u
JOIN "Merchant" AS m ON m."merchantId" = u."merchantId"
WHERE w."userId" = u."id"
  AND w."currency" IS DISTINCT FROM m."currency";

UPDATE "MerchantLaunchSession" AS s
SET "currency" = m."currency"
FROM "Merchant" AS m
WHERE s."merchantId" = m."merchantId"
  AND s."status" = 'ACTIVE'
  AND s."currency" IS DISTINCT FROM m."currency";
