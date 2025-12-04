-- CreateIndex
CREATE INDEX "idx_round_status_id" ON "Round"("status", "id");

-- CreateIndex
CREATE INDEX "idx_bet_user_created" ON "Bet"("userId", "createdAt");

