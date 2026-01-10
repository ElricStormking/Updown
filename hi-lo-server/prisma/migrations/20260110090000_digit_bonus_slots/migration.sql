-- Add digit bonus slots to rounds (per-round, server-authoritative).
ALTER TABLE "Round" ADD COLUMN "digitBonusSlots" JSONB;
ALTER TABLE "Round" ADD COLUMN "digitBonusFactor" DECIMAL(6, 3);

