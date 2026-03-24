-- CreateTable
CREATE TABLE "TVAlertsQualityConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minScore" REAL NOT NULL DEFAULT 5.0,
    "trendFilter" BOOLEAN NOT NULL DEFAULT true,
    "trendWeight" INTEGER NOT NULL DEFAULT 25,
    "momentumFilter" BOOLEAN NOT NULL DEFAULT true,
    "momentumWeight" INTEGER NOT NULL DEFAULT 20,
    "volatilityFilter" BOOLEAN NOT NULL DEFAULT true,
    "volatilityWeight" INTEGER NOT NULL DEFAULT 20,
    "htfFilter" BOOLEAN NOT NULL DEFAULT true,
    "htfWeight" INTEGER NOT NULL DEFAULT 20,
    "sessionFilter" BOOLEAN NOT NULL DEFAULT true,
    "sessionWeight" INTEGER NOT NULL DEFAULT 15,
    "autoSL" BOOLEAN NOT NULL DEFAULT true,
    "slAtrMultiplier" REAL NOT NULL DEFAULT 1.5,
    "autoTP" BOOLEAN NOT NULL DEFAULT true,
    "tpRiskRewardRatio" REAL NOT NULL DEFAULT 2.0,
    "dynamicSizing" BOOLEAN NOT NULL DEFAULT false,
    "highConfThreshold" REAL NOT NULL DEFAULT 7.5,
    "highConfMultiplier" REAL NOT NULL DEFAULT 1.25,
    "lowConfThreshold" REAL NOT NULL DEFAULT 5.5,
    "lowConfMultiplier" REAL NOT NULL DEFAULT 0.75,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SmartFlowOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "scanMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoresJson" TEXT NOT NULL DEFAULT '{}',
    "regime" TEXT,
    "session" TEXT,
    "preset" TEXT,
    "entryPrice" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "takeProfit" REAL NOT NULL,
    "riskPips" REAL NOT NULL,
    "rewardPips" REAL NOT NULL,
    "riskRewardRatio" REAL NOT NULL,
    "positionSize" INTEGER NOT NULL DEFAULT 0,
    "reasons" TEXT NOT NULL DEFAULT '[]',
    "filterResults" TEXT NOT NULL DEFAULT '{}',
    "resultConfigId" TEXT,
    "resultTradeId" TEXT,
    "realizedPL" REAL,
    "outcome" TEXT,
    "expiresAt" DATETIME,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "placedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SmartFlowSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxConcurrentTrades" INTEGER NOT NULL DEFAULT 3,
    "maxMarginPercent" REAL NOT NULL DEFAULT 40.0,
    "defaultPreset" TEXT NOT NULL DEFAULT 'steady_growth',
    "correlationWarningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxCorrelatedPairs" INTEGER NOT NULL DEFAULT 2,
    "aiBudgetDailyUsd" REAL NOT NULL DEFAULT 1.0,
    "aiBudgetMonthlyUsd" REAL NOT NULL DEFAULT 20.0,
    "aiDefaultModel" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "defaultMaxDrawdownPercent" REAL NOT NULL DEFAULT 5.0,
    "defaultMaxHoldHours" INTEGER NOT NULL DEFAULT 168,
    "defaultMaxFinancingUsd" REAL NOT NULL DEFAULT 50.0,
    "spreadProtectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "spreadProtectionMultiple" REAL NOT NULL DEFAULT 3.0,
    "shadowMode" BOOLEAN NOT NULL DEFAULT false,
    "scannerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scanIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "operatingMode" TEXT NOT NULL DEFAULT 'full_auto',
    "autoTradeMinScore" INTEGER NOT NULL DEFAULT 60,
    "scanModesJson" TEXT NOT NULL DEFAULT '{}',
    "pairWhitelistJson" TEXT NOT NULL DEFAULT '[]',
    "maxDailyScans" INTEGER NOT NULL DEFAULT 50,
    "maxDailyAutoTrades" INTEGER NOT NULL DEFAULT 5,
    "preferredPreset" TEXT NOT NULL DEFAULT 'auto',
    "scannerEntryMode" TEXT NOT NULL DEFAULT 'optimal',
    "sessionRestriction" TEXT NOT NULL DEFAULT 'kill_zones',
    "newsBufferMinutes" INTEGER NOT NULL DEFAULT 60,
    "circuitBreakerConsecLosses" INTEGER NOT NULL DEFAULT 3,
    "circuitBreakerConsecPause" INTEGER NOT NULL DEFAULT 120,
    "circuitBreakerDailyLosses" INTEGER NOT NULL DEFAULT 4,
    "circuitBreakerDailyDD" REAL NOT NULL DEFAULT 3.0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SmartFlowSettings" ("aiBudgetDailyUsd", "aiBudgetMonthlyUsd", "aiDefaultModel", "correlationWarningEnabled", "defaultMaxDrawdownPercent", "defaultMaxFinancingUsd", "defaultMaxHoldHours", "defaultPreset", "enabled", "id", "maxConcurrentTrades", "maxCorrelatedPairs", "maxMarginPercent", "spreadProtectionEnabled", "spreadProtectionMultiple", "updatedAt") SELECT "aiBudgetDailyUsd", "aiBudgetMonthlyUsd", "aiDefaultModel", "correlationWarningEnabled", "defaultMaxDrawdownPercent", "defaultMaxFinancingUsd", "defaultMaxHoldHours", "defaultPreset", "enabled", "id", "maxConcurrentTrades", "maxCorrelatedPairs", "maxMarginPercent", "spreadProtectionEnabled", "spreadProtectionMultiple", "updatedAt" FROM "SmartFlowSettings";
DROP TABLE "SmartFlowSettings";
ALTER TABLE "new_SmartFlowSettings" RENAME TO "SmartFlowSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SmartFlowOpportunity_instrument_status_idx" ON "SmartFlowOpportunity"("instrument", "status");

-- CreateIndex
CREATE INDEX "SmartFlowOpportunity_status_score_idx" ON "SmartFlowOpportunity"("status", "score");

-- CreateIndex
CREATE INDEX "SmartFlowOpportunity_scanMode_status_idx" ON "SmartFlowOpportunity"("scanMode", "status");

-- CreateIndex
CREATE INDEX "SmartFlowOpportunity_detectedAt_idx" ON "SmartFlowOpportunity"("detectedAt");
