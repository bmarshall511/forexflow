-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SmartFlowConfig" (
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
    "aiMode" TEXT NOT NULL DEFAULT 'auto_selective',
    "aiMonitorIntervalHours" INTEGER NOT NULL DEFAULT 1,
    "aiModel" TEXT,
    "aiActionTogglesJson" TEXT NOT NULL DEFAULT '{"moveSL":true,"moveTP":true,"breakeven":true,"partialClose":true,"closeProfit":true,"preemptiveSafetyClose":true,"cancelEntry":true,"adjustTrail":true}',
    "aiConfidenceThresholdsJson" TEXT NOT NULL DEFAULT '{}',
    "aiMaxActionsPerDay" INTEGER NOT NULL DEFAULT 10,
    "aiCooldownAfterManualMins" INTEGER NOT NULL DEFAULT 120,
    "aiGracePeriodMins" INTEGER NOT NULL DEFAULT 15,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SmartFlowConfig" ("aiActionTogglesJson", "aiConfidenceThresholdsJson", "aiCooldownAfterManualMins", "aiGracePeriodMins", "aiMaxActionsPerDay", "aiMode", "aiModel", "aiMonitorIntervalHours", "breakevenAtrMultiple", "breakevenBufferPips", "breakevenEnabled", "createdAt", "direction", "entryConditionsJson", "entryExpireHours", "entryMode", "entryPrice", "id", "instrument", "isActive", "maxDrawdownPercent", "maxDrawdownPips", "maxFinancingUsd", "maxHoldHours", "minRiskReward", "name", "newsProtectionEnabled", "newsProtectionMinutes", "offSessionBehavior", "partialCloseRulesJson", "positionSizeMode", "positionSizeValue", "preset", "recoveryAtrInterval", "recoveryEnabled", "recoveryMaxLevels", "recoverySizeMultiplier", "recoveryTpAtrMultiple", "sessionAwareManagement", "stopLossAtrMultiple", "stopLossPips", "takeProfitAtrMultiple", "takeProfitPips", "trailingActivationAtr", "trailingAtrMultiple", "trailingEnabled", "updatedAt", "weekendCloseEnabled") SELECT "aiActionTogglesJson", "aiConfidenceThresholdsJson", "aiCooldownAfterManualMins", "aiGracePeriodMins", "aiMaxActionsPerDay", "aiMode", "aiModel", "aiMonitorIntervalHours", "breakevenAtrMultiple", "breakevenBufferPips", "breakevenEnabled", "createdAt", "direction", "entryConditionsJson", "entryExpireHours", "entryMode", "entryPrice", "id", "instrument", "isActive", "maxDrawdownPercent", "maxDrawdownPips", "maxFinancingUsd", "maxHoldHours", "minRiskReward", "name", "newsProtectionEnabled", "newsProtectionMinutes", "offSessionBehavior", "partialCloseRulesJson", "positionSizeMode", "positionSizeValue", "preset", "recoveryAtrInterval", "recoveryEnabled", "recoveryMaxLevels", "recoverySizeMultiplier", "recoveryTpAtrMultiple", "sessionAwareManagement", "stopLossAtrMultiple", "stopLossPips", "takeProfitAtrMultiple", "takeProfitPips", "trailingActivationAtr", "trailingAtrMultiple", "trailingEnabled", "updatedAt", "weekendCloseEnabled" FROM "SmartFlowConfig";
DROP TABLE "SmartFlowConfig";
ALTER TABLE "new_SmartFlowConfig" RENAME TO "SmartFlowConfig";
CREATE INDEX "SmartFlowConfig_instrument_isActive_idx" ON "SmartFlowConfig"("instrument", "isActive");
CREATE INDEX "SmartFlowConfig_instrument_direction_idx" ON "SmartFlowConfig"("instrument", "direction");
CREATE TABLE "new_TradeFinderConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minScore" REAL NOT NULL DEFAULT 7.0,
    "maxEnabledPairs" INTEGER NOT NULL DEFAULT 10,
    "approachingAtrMultiple" REAL NOT NULL DEFAULT 1.5,
    "autoTradeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoTradeMinScore" REAL NOT NULL DEFAULT 11.0,
    "autoTradeMaxConcurrent" INTEGER NOT NULL DEFAULT 3,
    "autoTradeMaxDaily" INTEGER NOT NULL DEFAULT 5,
    "autoTradeMaxRiskPercent" REAL NOT NULL DEFAULT 6.0,
    "autoTradeMinRR" REAL NOT NULL DEFAULT 2.0,
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
    "partialExitStrategy" TEXT NOT NULL DEFAULT 'standard',
    "shadowMode" BOOLEAN NOT NULL DEFAULT false,
    "pairsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TradeFinderConfig" ("approachingAtrMultiple", "autoTradeCancelOnInvalidation", "autoTradeEnabled", "autoTradeMaxConcurrent", "autoTradeMaxDaily", "autoTradeMaxRiskPercent", "autoTradeMinRR", "autoTradeMinScore", "breakevenEnabled", "confirmationTimeout", "enabled", "entryConfirmation", "id", "maxEnabledPairs", "minScore", "pairsJson", "partialCloseEnabled", "partialClosePercent", "partialCloseRR", "smartSizing", "timeExitCandles", "timeExitEnabled", "trailingStopCandles", "trailingStopEnabled", "updatedAt") SELECT "approachingAtrMultiple", "autoTradeCancelOnInvalidation", "autoTradeEnabled", "autoTradeMaxConcurrent", "autoTradeMaxDaily", "autoTradeMaxRiskPercent", "autoTradeMinRR", "autoTradeMinScore", "breakevenEnabled", "confirmationTimeout", "enabled", "entryConfirmation", "id", "maxEnabledPairs", "minScore", "pairsJson", "partialCloseEnabled", "partialClosePercent", "partialCloseRR", "smartSizing", "timeExitCandles", "timeExitEnabled", "trailingStopCandles", "trailingStopEnabled", "updatedAt" FROM "TradeFinderConfig";
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
    "confirmationCandlesWaited" INTEGER NOT NULL DEFAULT 0,
    "breakevenMoved" BOOLEAN NOT NULL DEFAULT false,
    "partialTaken" BOOLEAN NOT NULL DEFAULT false,
    "managementLog" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TradeFinderSetup" ("autoPlaced", "breakevenMoved", "confirmationPattern", "createdAt", "curveJson", "detectedAt", "direction", "distanceToEntry", "entryPrice", "expiredAt", "id", "instrument", "lastSkipReason", "lastUpdatedAt", "managementLog", "partialTaken", "placedAt", "positionSize", "resultSourceId", "rewardPips", "riskPips", "rrRatio", "scoreTotal", "scoresJson", "status", "stopLoss", "takeProfit", "timeframeSet", "trendJson", "updatedAt", "zoneJson") SELECT "autoPlaced", "breakevenMoved", "confirmationPattern", "createdAt", "curveJson", "detectedAt", "direction", "distanceToEntry", "entryPrice", "expiredAt", "id", "instrument", "lastSkipReason", "lastUpdatedAt", "managementLog", "partialTaken", "placedAt", "positionSize", "resultSourceId", "rewardPips", "riskPips", "rrRatio", "scoreTotal", "scoresJson", "status", "stopLoss", "takeProfit", "timeframeSet", "trendJson", "updatedAt", "zoneJson" FROM "TradeFinderSetup";
DROP TABLE "TradeFinderSetup";
ALTER TABLE "new_TradeFinderSetup" RENAME TO "TradeFinderSetup";
CREATE INDEX "TradeFinderSetup_instrument_status_idx" ON "TradeFinderSetup"("instrument", "status");
CREATE INDEX "TradeFinderSetup_status_scoreTotal_idx" ON "TradeFinderSetup"("status", "scoreTotal");
CREATE INDEX "TradeFinderSetup_status_detectedAt_idx" ON "TradeFinderSetup"("status", "detectedAt");
CREATE INDEX "TradeFinderSetup_autoPlaced_placedAt_idx" ON "TradeFinderSetup"("autoPlaced", "placedAt");
CREATE INDEX "TradeFinderSetup_placedAt_idx" ON "TradeFinderSetup"("placedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
