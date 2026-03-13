-- Add placedAt column for accurate daily auto-trade cap counting
ALTER TABLE "TradeFinderSetup" ADD COLUMN "placedAt" DATETIME;

-- Backfill: only set placedAt for setups still in "placed" status (actively pending).
-- Do NOT backfill invalidated/expired — lastUpdatedAt reflects invalidation time, not placement time.
UPDATE "TradeFinderSetup" SET "placedAt" = "lastUpdatedAt" WHERE "autoPlaced" = 1 AND "status" = 'placed';

-- Index for efficient daily cap query
CREATE INDEX "TradeFinderSetup_autoPlaced_placedAt_idx" ON "TradeFinderSetup"("autoPlaced", "placedAt");
