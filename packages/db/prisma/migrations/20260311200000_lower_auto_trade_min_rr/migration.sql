-- Add missing auto-trade columns to TradeFinderConfig
ALTER TABLE "TradeFinderConfig" ADD COLUMN "autoTradeMinScore" REAL NOT NULL DEFAULT 9.0;
ALTER TABLE "TradeFinderConfig" ADD COLUMN "autoTradeMaxConcurrent" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "TradeFinderConfig" ADD COLUMN "autoTradeMaxDaily" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "TradeFinderConfig" ADD COLUMN "autoTradeMaxRiskPercent" REAL NOT NULL DEFAULT 6.0;
ALTER TABLE "TradeFinderConfig" ADD COLUMN "autoTradeMinRR" REAL NOT NULL DEFAULT 1.5;
ALTER TABLE "TradeFinderConfig" ADD COLUMN "autoTradeCancelOnInvalidation" BOOLEAN NOT NULL DEFAULT true;

-- Add missing auto-trade columns to TradeFinderSetup
ALTER TABLE "TradeFinderSetup" ADD COLUMN "autoPlaced" BOOLEAN NOT NULL DEFAULT false;

-- Lower autoTradeMinRR default from 2.0 to 1.5
-- The profitZone score already gates R:R quality, making 2.0 too restrictive.
-- Only update rows that still have the old default (haven't been manually changed).
UPDATE "TradeFinderConfig" SET "autoTradeMinRR" = 1.5 WHERE "autoTradeMinRR" = 2.0;
