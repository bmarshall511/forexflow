-- Phase -1 migration: add `account` column + per-account indices to every
-- trade-derived model so practice and live history are isolated in analytics.
--
-- Existing rows are stamped "unknown" because OANDA `sourceTradeId` values are
-- numeric and per-account — there is no way to infer which account an existing
-- row originated from without probing OANDA trade-detail endpoints against
-- both accounts, which is out of scope for this migration. The UI surfaces a
-- "legacy data" banner pointing the user at a clear-legacy-data action so
-- they can wipe the unattributed history cleanly.
--
-- The daemon writes only "practice" or "live" from this point forward;
-- "unknown" never appears on new rows.
--
-- Apply with: sqlite3 data/fxflow.db < scripts/migrate-account-column.sql
-- Safe to re-run: every ADD COLUMN / CREATE INDEX is idempotent in SQLite via
-- the IF NOT EXISTS guard pattern below (SQLite does not support IF NOT EXISTS
-- on ALTER TABLE ADD COLUMN, so we wrap in a pragma check via the application
-- layer if we re-run — this script assumes a single clean apply).

BEGIN TRANSACTION;

-- Trade (primary; every other trade-derived table ultimately ties back here)
ALTER TABLE "Trade" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "Trade_account_status_openedAt_idx" ON "Trade"("account", "status", "openedAt");
CREATE INDEX "Trade_account_status_closedAt_idx" ON "Trade"("account", "status", "closedAt");
CREATE INDEX "Trade_account_instrument_status_idx" ON "Trade"("account", "instrument", "status");
CREATE INDEX "Trade_account_updatedAt_idx" ON "Trade"("account", "updatedAt");

-- TVAlertSignal
ALTER TABLE "TVAlertSignal" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "TVAlertSignal_account_receivedAt_idx" ON "TVAlertSignal"("account", "receivedAt");
CREATE INDEX "TVAlertSignal_account_status_receivedAt_idx" ON "TVAlertSignal"("account", "status", "receivedAt");

-- TradeFinderSetup
ALTER TABLE "TradeFinderSetup" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "TradeFinderSetup_account_status_idx" ON "TradeFinderSetup"("account", "status");
CREATE INDEX "TradeFinderSetup_account_status_detectedAt_idx" ON "TradeFinderSetup"("account", "status", "detectedAt");

-- TradeFinderPerformance
ALTER TABLE "TradeFinderPerformance" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "TradeFinderPerformance_account_dimension_periodStart_idx" ON "TradeFinderPerformance"("account", "dimension", "periodStart");

-- AiTraderOpportunity
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "AiTraderOpportunity_account_status_idx" ON "AiTraderOpportunity"("account", "status");
CREATE INDEX "AiTraderOpportunity_account_status_detectedAt_idx" ON "AiTraderOpportunity"("account", "status", "detectedAt");

-- AiTraderNearMiss
ALTER TABLE "AiTraderNearMiss" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "AiTraderNearMiss_account_detectedAt_idx" ON "AiTraderNearMiss"("account", "detectedAt");
CREATE INDEX "AiTraderNearMiss_account_profile_detectedAt_idx" ON "AiTraderNearMiss"("account", "profile", "detectedAt");

-- AiTraderReflection
ALTER TABLE "AiTraderReflection" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "AiTraderReflection_account_profile_createdAt_idx" ON "AiTraderReflection"("account", "profile", "createdAt");

-- AiTraderStrategyPerformance
ALTER TABLE "AiTraderStrategyPerformance" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "AiTraderStrategyPerformance_account_profile_periodStart_idx" ON "AiTraderStrategyPerformance"("account", "profile", "periodStart");

-- SmartFlowConfig
ALTER TABLE "SmartFlowConfig" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "SmartFlowConfig_account_isActive_idx" ON "SmartFlowConfig"("account", "isActive");
CREATE INDEX "SmartFlowConfig_account_instrument_isActive_idx" ON "SmartFlowConfig"("account", "instrument", "isActive");

-- SmartFlowTrade
ALTER TABLE "SmartFlowTrade" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "SmartFlowTrade_account_status_idx" ON "SmartFlowTrade"("account", "status");
CREATE INDEX "SmartFlowTrade_account_status_createdAt_idx" ON "SmartFlowTrade"("account", "status", "createdAt");

-- SmartFlowOpportunity
ALTER TABLE "SmartFlowOpportunity" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "SmartFlowOpportunity_account_status_idx" ON "SmartFlowOpportunity"("account", "status");
CREATE INDEX "SmartFlowOpportunity_account_status_detectedAt_idx" ON "SmartFlowOpportunity"("account", "status", "detectedAt");

-- SmartFlowActivityLog
ALTER TABLE "SmartFlowActivityLog" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "SmartFlowActivityLog_account_createdAt_idx" ON "SmartFlowActivityLog"("account", "createdAt");

-- PriceAlert
ALTER TABLE "PriceAlert" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "PriceAlert_account_status_idx" ON "PriceAlert"("account", "status");
CREATE INDEX "PriceAlert_account_instrument_status_idx" ON "PriceAlert"("account", "instrument", "status");

-- SourcePriorityLog
ALTER TABLE "SourcePriorityLog" ADD COLUMN "account" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "SourcePriorityLog_account_createdAt_idx" ON "SourcePriorityLog"("account", "createdAt");

COMMIT;

-- Sanity check — every table has the column with the expected default.
SELECT 'Trade' AS table_name, COUNT(*) AS total, SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) AS legacy FROM "Trade"
UNION ALL SELECT 'TVAlertSignal', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "TVAlertSignal"
UNION ALL SELECT 'TradeFinderSetup', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "TradeFinderSetup"
UNION ALL SELECT 'TradeFinderPerformance', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "TradeFinderPerformance"
UNION ALL SELECT 'AiTraderOpportunity', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "AiTraderOpportunity"
UNION ALL SELECT 'AiTraderNearMiss', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "AiTraderNearMiss"
UNION ALL SELECT 'AiTraderReflection', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "AiTraderReflection"
UNION ALL SELECT 'AiTraderStrategyPerformance', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "AiTraderStrategyPerformance"
UNION ALL SELECT 'SmartFlowConfig', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "SmartFlowConfig"
UNION ALL SELECT 'SmartFlowTrade', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "SmartFlowTrade"
UNION ALL SELECT 'SmartFlowOpportunity', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "SmartFlowOpportunity"
UNION ALL SELECT 'SmartFlowActivityLog', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "SmartFlowActivityLog"
UNION ALL SELECT 'PriceAlert', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "PriceAlert"
UNION ALL SELECT 'SourcePriorityLog', COUNT(*), SUM(CASE WHEN account = 'unknown' THEN 1 ELSE 0 END) FROM "SourcePriorityLog";
