-- CreateTable
CREATE TABLE "TradeFinderPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dimension" TEXT NOT NULL,
    "dimensionKey" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalSetups" INTEGER NOT NULL DEFAULT 0,
    "placed" INTEGER NOT NULL DEFAULT 0,
    "filled" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "breakevens" INTEGER NOT NULL DEFAULT 0,
    "totalPL" REAL NOT NULL DEFAULT 0,
    "avgRR" REAL NOT NULL DEFAULT 0,
    "expectedRR" REAL NOT NULL DEFAULT 0,
    "profitFactor" REAL NOT NULL DEFAULT 0,
    "expectancy" REAL NOT NULL DEFAULT 0,
    "maxDrawdown" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourcePriorityConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "priorityOrder" TEXT NOT NULL DEFAULT '["trade_finder","tv_alerts","ai_trader","smart_flow"]',
    "autoSelectWindowDays" INTEGER NOT NULL DEFAULT 30,
    "autoSelectRecalcMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourcePriorityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "requestingSource" TEXT NOT NULL,
    "existingSource" TEXT,
    "existingTradeId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SmartFlowSettings" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SmartFlowConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT 'steady_growth',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "entryMode" TEXT NOT NULL DEFAULT 'market',
    "entryPrice" REAL,
    "entryConditionsJson" TEXT,
    "entryExpireHours" INTEGER,
    "positionSizeMode" TEXT NOT NULL DEFAULT 'risk_percent',
    "positionSizeValue" REAL NOT NULL DEFAULT 1.0,
    "stopLossAtrMultiple" REAL,
    "takeProfitAtrMultiple" REAL,
    "stopLossPips" REAL,
    "takeProfitPips" REAL,
    "minRiskReward" REAL NOT NULL DEFAULT 1.5,
    "breakevenEnabled" BOOLEAN NOT NULL DEFAULT true,
    "breakevenAtrMultiple" REAL NOT NULL DEFAULT 0.75,
    "breakevenBufferPips" REAL NOT NULL DEFAULT 2.0,
    "trailingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trailingAtrMultiple" REAL NOT NULL DEFAULT 0.5,
    "trailingActivationAtr" REAL NOT NULL DEFAULT 0.75,
    "partialCloseRulesJson" TEXT,
    "maxDrawdownPercent" REAL,
    "maxDrawdownPips" REAL,
    "maxHoldHours" INTEGER,
    "maxFinancingUsd" REAL,
    "sessionAwareManagement" BOOLEAN NOT NULL DEFAULT true,
    "offSessionBehavior" TEXT NOT NULL DEFAULT 'widen_thresholds',
    "weekendCloseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "newsProtectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newsProtectionMinutes" INTEGER NOT NULL DEFAULT 30,
    "recoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryMaxLevels" INTEGER NOT NULL DEFAULT 3,
    "recoveryAtrInterval" REAL NOT NULL DEFAULT 0.5,
    "recoverySizeMultiplier" REAL NOT NULL DEFAULT 0.5,
    "recoveryTpAtrMultiple" REAL NOT NULL DEFAULT 0.3,
    "aiMode" TEXT NOT NULL DEFAULT 'off',
    "aiMonitorIntervalHours" INTEGER NOT NULL DEFAULT 4,
    "aiModel" TEXT,
    "aiActionTogglesJson" TEXT NOT NULL DEFAULT '{}',
    "aiConfidenceThresholdsJson" TEXT NOT NULL DEFAULT '{}',
    "aiMaxActionsPerDay" INTEGER NOT NULL DEFAULT 10,
    "aiCooldownAfterManualMins" INTEGER NOT NULL DEFAULT 120,
    "aiGracePeriodMins" INTEGER NOT NULL DEFAULT 15,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SmartFlowTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "tradeId" TEXT,
    "sourceTradeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting_entry',
    "entryPrice" REAL,
    "currentPhase" TEXT NOT NULL DEFAULT 'entry',
    "breakevenTriggered" BOOLEAN NOT NULL DEFAULT false,
    "trailingActivated" BOOLEAN NOT NULL DEFAULT false,
    "partialCloseLogJson" TEXT NOT NULL DEFAULT '[]',
    "managementLogJson" TEXT NOT NULL DEFAULT '[]',
    "recoveryLevel" INTEGER NOT NULL DEFAULT 0,
    "recoveryTradeIds" TEXT NOT NULL DEFAULT '[]',
    "estimatedHours" REAL,
    "estimatedLow" REAL,
    "estimatedHigh" REAL,
    "safetyNetTriggered" TEXT,
    "financingAccumulated" REAL NOT NULL DEFAULT 0,
    "entrySpread" REAL,
    "avgSpread" REAL,
    "aiActionsToday" INTEGER NOT NULL DEFAULT 0,
    "aiLastActionAt" DATETIME,
    "aiTotalCost" REAL NOT NULL DEFAULT 0,
    "aiTotalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "aiTotalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "aiSuggestionsLogJson" TEXT NOT NULL DEFAULT '[]',
    "lastManualOverrideAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartFlowTrade_configId_fkey" FOREIGN KEY ("configId") REFERENCES "SmartFlowConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmartFlowTimeEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "targetPips" REAL NOT NULL,
    "actualHours" REAL NOT NULL,
    "outcome" TEXT NOT NULL,
    "closedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SmartFlowActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "instrument" TEXT,
    "tradeId" TEXT,
    "configId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiTraderConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "operatingMode" TEXT NOT NULL DEFAULT 'manual',
    "scanIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "confidenceThreshold" INTEGER NOT NULL DEFAULT 70,
    "minimumConfidence" INTEGER NOT NULL DEFAULT 60,
    "maxConcurrentTrades" INTEGER NOT NULL DEFAULT 5,
    "pairWhitelist" TEXT NOT NULL DEFAULT '[]',
    "enabledProfiles" TEXT NOT NULL DEFAULT '{}',
    "enabledTechniques" TEXT NOT NULL DEFAULT '{}',
    "managementConfig" TEXT NOT NULL DEFAULT '{}',
    "reEvalIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "dailyBudgetUsd" REAL NOT NULL DEFAULT 5.0,
    "monthlyBudgetUsd" REAL NOT NULL DEFAULT 100.0,
    "scanModel" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "decisionModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "fredApiKey" TEXT,
    "alphaVantageApiKey" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiTraderConfig" ("alphaVantageApiKey", "confidenceThreshold", "dailyBudgetUsd", "decisionModel", "enabled", "enabledProfiles", "enabledTechniques", "fredApiKey", "id", "managementConfig", "maxConcurrentTrades", "minimumConfidence", "monthlyBudgetUsd", "operatingMode", "pairWhitelist", "reEvalIntervalMinutes", "scanIntervalMinutes", "scanModel", "updatedAt") SELECT "alphaVantageApiKey", "confidenceThreshold", "dailyBudgetUsd", "decisionModel", "enabled", "enabledProfiles", "enabledTechniques", "fredApiKey", "id", "managementConfig", "maxConcurrentTrades", "minimumConfidence", "monthlyBudgetUsd", "operatingMode", "pairWhitelist", "reEvalIntervalMinutes", "scanIntervalMinutes", "scanModel", "updatedAt" FROM "AiTraderConfig";
DROP TABLE "AiTraderConfig";
ALTER TABLE "new_AiTraderConfig" RENAME TO "AiTraderConfig";
CREATE TABLE "new_TradeFinderConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minScore" REAL NOT NULL DEFAULT 7.0,
    "maxEnabledPairs" INTEGER NOT NULL DEFAULT 10,
    "approachingAtrMultiple" REAL NOT NULL DEFAULT 1.5,
    "autoTradeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoTradeMinScore" REAL NOT NULL DEFAULT 9.0,
    "autoTradeMaxConcurrent" INTEGER NOT NULL DEFAULT 3,
    "autoTradeMaxDaily" INTEGER NOT NULL DEFAULT 5,
    "autoTradeMaxRiskPercent" REAL NOT NULL DEFAULT 6.0,
    "autoTradeMinRR" REAL NOT NULL DEFAULT 1.5,
    "autoTradeCancelOnInvalidation" BOOLEAN NOT NULL DEFAULT true,
    "smartSizing" BOOLEAN NOT NULL DEFAULT true,
    "entryConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "confirmationTimeout" INTEGER NOT NULL DEFAULT 6,
    "breakevenEnabled" BOOLEAN NOT NULL DEFAULT true,
    "partialCloseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "partialClosePercent" REAL NOT NULL DEFAULT 50,
    "partialCloseRR" REAL NOT NULL DEFAULT 1.5,
    "trailingStopEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trailingStopCandles" INTEGER NOT NULL DEFAULT 3,
    "timeExitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timeExitCandles" INTEGER NOT NULL DEFAULT 20,
    "pairsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TradeFinderConfig" ("approachingAtrMultiple", "autoTradeCancelOnInvalidation", "autoTradeEnabled", "autoTradeMaxConcurrent", "autoTradeMaxDaily", "autoTradeMaxRiskPercent", "autoTradeMinRR", "autoTradeMinScore", "enabled", "id", "maxEnabledPairs", "minScore", "pairsJson", "updatedAt") SELECT "approachingAtrMultiple", "autoTradeCancelOnInvalidation", "autoTradeEnabled", "autoTradeMaxConcurrent", "autoTradeMaxDaily", "autoTradeMaxRiskPercent", "autoTradeMinRR", "autoTradeMinScore", "enabled", "id", "maxEnabledPairs", "minScore", "pairsJson", "updatedAt" FROM "TradeFinderConfig";
DROP TABLE "TradeFinderConfig";
ALTER TABLE "new_TradeFinderConfig" RENAME TO "TradeFinderConfig";
CREATE TABLE "new_TradeFinderSetup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "timeframeSet" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "entryPrice" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "takeProfit" REAL NOT NULL,
    "riskPips" REAL NOT NULL,
    "rewardPips" REAL NOT NULL,
    "rrRatio" TEXT NOT NULL,
    "positionSize" REAL NOT NULL,
    "scoresJson" TEXT NOT NULL DEFAULT '{}',
    "scoreTotal" REAL NOT NULL DEFAULT 0,
    "zoneJson" TEXT NOT NULL DEFAULT '{}',
    "trendJson" TEXT,
    "curveJson" TEXT,
    "distanceToEntry" REAL NOT NULL DEFAULT 0,
    "resultSourceId" TEXT,
    "autoPlaced" BOOLEAN NOT NULL DEFAULT false,
    "placedAt" DATETIME,
    "lastSkipReason" TEXT,
    "confirmationPattern" TEXT,
    "breakevenMoved" BOOLEAN NOT NULL DEFAULT false,
    "partialTaken" BOOLEAN NOT NULL DEFAULT false,
    "managementLog" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TradeFinderSetup" ("autoPlaced", "createdAt", "curveJson", "detectedAt", "direction", "distanceToEntry", "entryPrice", "expiredAt", "id", "instrument", "lastUpdatedAt", "placedAt", "positionSize", "resultSourceId", "rewardPips", "riskPips", "rrRatio", "scoreTotal", "scoresJson", "status", "stopLoss", "takeProfit", "timeframeSet", "trendJson", "updatedAt", "zoneJson") SELECT "autoPlaced", "createdAt", "curveJson", "detectedAt", "direction", "distanceToEntry", "entryPrice", "expiredAt", "id", "instrument", "lastUpdatedAt", "placedAt", "positionSize", "resultSourceId", "rewardPips", "riskPips", "rrRatio", "scoreTotal", "scoresJson", "status", "stopLoss", "takeProfit", "timeframeSet", "trendJson", "updatedAt", "zoneJson" FROM "TradeFinderSetup";
DROP TABLE "TradeFinderSetup";
ALTER TABLE "new_TradeFinderSetup" RENAME TO "TradeFinderSetup";
CREATE INDEX "TradeFinderSetup_instrument_status_idx" ON "TradeFinderSetup"("instrument", "status");
CREATE INDEX "TradeFinderSetup_status_scoreTotal_idx" ON "TradeFinderSetup"("status", "scoreTotal");
CREATE INDEX "TradeFinderSetup_status_detectedAt_idx" ON "TradeFinderSetup"("status", "detectedAt");
CREATE INDEX "TradeFinderSetup_autoPlaced_placedAt_idx" ON "TradeFinderSetup"("autoPlaced", "placedAt");
CREATE INDEX "TradeFinderSetup_placedAt_idx" ON "TradeFinderSetup"("placedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TradeFinderPerformance_dimension_dimensionKey_periodStart_idx" ON "TradeFinderPerformance"("dimension", "dimensionKey", "periodStart");

-- CreateIndex
CREATE INDEX "TradeFinderPerformance_dimension_periodStart_idx" ON "TradeFinderPerformance"("dimension", "periodStart");

-- CreateIndex
CREATE INDEX "SourcePriorityLog_instrument_createdAt_idx" ON "SourcePriorityLog"("instrument", "createdAt");

-- CreateIndex
CREATE INDEX "SourcePriorityLog_requestingSource_createdAt_idx" ON "SourcePriorityLog"("requestingSource", "createdAt");

-- CreateIndex
CREATE INDEX "SourcePriorityLog_createdAt_idx" ON "SourcePriorityLog"("createdAt");

-- CreateIndex
CREATE INDEX "SmartFlowConfig_instrument_isActive_idx" ON "SmartFlowConfig"("instrument", "isActive");

-- CreateIndex
CREATE INDEX "SmartFlowConfig_instrument_direction_idx" ON "SmartFlowConfig"("instrument", "direction");

-- CreateIndex
CREATE INDEX "SmartFlowTrade_configId_idx" ON "SmartFlowTrade"("configId");

-- CreateIndex
CREATE INDEX "SmartFlowTrade_status_idx" ON "SmartFlowTrade"("status");

-- CreateIndex
CREATE INDEX "SmartFlowTrade_tradeId_idx" ON "SmartFlowTrade"("tradeId");

-- CreateIndex
CREATE INDEX "SmartFlowTrade_sourceTradeId_idx" ON "SmartFlowTrade"("sourceTradeId");

-- CreateIndex
CREATE INDEX "SmartFlowTimeEstimate_instrument_preset_direction_idx" ON "SmartFlowTimeEstimate"("instrument", "preset", "direction");

-- CreateIndex
CREATE INDEX "SmartFlowTimeEstimate_closedAt_idx" ON "SmartFlowTimeEstimate"("closedAt");

-- CreateIndex
CREATE INDEX "SmartFlowActivityLog_createdAt_idx" ON "SmartFlowActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "SmartFlowActivityLog_configId_createdAt_idx" ON "SmartFlowActivityLog"("configId", "createdAt");

-- CreateIndex
CREATE INDEX "SmartFlowActivityLog_instrument_createdAt_idx" ON "SmartFlowActivityLog"("instrument", "createdAt");
