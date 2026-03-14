-- CreateTable
CREATE TABLE "AiRecommendationOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "winProbability" REAL NOT NULL,
    "qualityScore" REAL NOT NULL,
    "actionFollowed" BOOLEAN NOT NULL DEFAULT false,
    "actionFollowedAt" DATETIME,
    "tradeOutcome" TEXT,
    "actualPnl" REAL,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sections" TEXT,
    "rawResponse" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SignalAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signalId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignalAuditEvent_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "TVAlertSignal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplyDemandZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "proximalLine" REAL NOT NULL,
    "distalLine" REAL NOT NULL,
    "width" REAL NOT NULL,
    "widthPips" REAL NOT NULL,
    "baseStartTime" INTEGER NOT NULL,
    "baseEndTime" INTEGER NOT NULL,
    "baseCandles" INTEGER NOT NULL,
    "baseStartIndex" INTEGER NOT NULL,
    "baseEndIndex" INTEGER NOT NULL,
    "scoreStrength" REAL NOT NULL DEFAULT 0,
    "scoreTime" REAL NOT NULL DEFAULT 0,
    "scoreFreshness" REAL NOT NULL DEFAULT 0,
    "scoreTotal" REAL NOT NULL DEFAULT 0,
    "scoresJson" TEXT NOT NULL DEFAULT '{}',
    "riskRewardJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "penetrationPct" REAL NOT NULL DEFAULT 0,
    "testCount" INTEGER NOT NULL DEFAULT 0,
    "firstDetectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConfirmedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScoredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ZoneSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DetectedTrend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" TEXT,
    "status" TEXT NOT NULL,
    "swingPointsJson" TEXT NOT NULL DEFAULT '[]',
    "segmentsJson" TEXT NOT NULL DEFAULT '[]',
    "controllingSwing" TEXT,
    "currentPrice" REAL NOT NULL,
    "candlesAnalyzed" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CurveSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "supplyDistal" REAL NOT NULL,
    "demandDistal" REAL NOT NULL,
    "highThreshold" REAL NOT NULL,
    "lowThreshold" REAL NOT NULL,
    "position" TEXT NOT NULL,
    "currentPrice" REAL NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrendSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiTraderConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "operatingMode" TEXT NOT NULL DEFAULT 'manual',
    "scanIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "confidenceThreshold" INTEGER NOT NULL DEFAULT 70,
    "minimumConfidence" INTEGER NOT NULL DEFAULT 50,
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

-- CreateTable
CREATE TABLE "AiTraderOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "scoresJson" TEXT NOT NULL DEFAULT '{}',
    "entryPrice" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "takeProfit" REAL NOT NULL,
    "riskPips" REAL NOT NULL,
    "rewardPips" REAL NOT NULL,
    "riskRewardRatio" REAL NOT NULL,
    "positionSize" INTEGER NOT NULL DEFAULT 0,
    "regime" TEXT,
    "session" TEXT,
    "primaryTechnique" TEXT,
    "entryRationale" TEXT,
    "technicalSnapshot" TEXT NOT NULL DEFAULT '{}',
    "fundamentalSnapshot" TEXT NOT NULL DEFAULT '{}',
    "sentimentSnapshot" TEXT NOT NULL DEFAULT '{}',
    "tier2Response" TEXT,
    "tier3Response" TEXT,
    "tier3Model" TEXT,
    "tier3InputTokens" INTEGER NOT NULL DEFAULT 0,
    "tier3OutputTokens" INTEGER NOT NULL DEFAULT 0,
    "tier3Cost" REAL NOT NULL DEFAULT 0,
    "resultTradeId" TEXT,
    "resultSourceId" TEXT,
    "realizedPL" REAL,
    "outcome" TEXT,
    "managementLog" TEXT NOT NULL DEFAULT '[]',
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suggestedAt" DATETIME,
    "placedAt" DATETIME,
    "filledAt" DATETIME,
    "closedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiTraderMarketData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataType" TEXT NOT NULL,
    "dataKey" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiTraderStrategyPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profile" TEXT NOT NULL,
    "instrument" TEXT,
    "session" TEXT,
    "technique" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "breakevens" INTEGER NOT NULL DEFAULT 0,
    "totalPL" REAL NOT NULL DEFAULT 0,
    "avgRR" REAL NOT NULL DEFAULT 0,
    "profitFactor" REAL NOT NULL DEFAULT 0,
    "expectancy" REAL NOT NULL DEFAULT 0,
    "maxDrawdown" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TVAlertSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'ut_bot_alerts',
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "rawPayload" TEXT NOT NULL,
    "resultTradeId" TEXT,
    "executionDetails" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "signalTime" DATETIME,
    "receivedAt" DATETIME NOT NULL,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TVAlertSignal" ("createdAt", "direction", "executionDetails", "id", "instrument", "processedAt", "rawPayload", "receivedAt", "rejectionReason", "resultTradeId", "signalTime", "source", "status") SELECT "createdAt", "direction", "executionDetails", "id", "instrument", "processedAt", "rawPayload", "receivedAt", "rejectionReason", "resultTradeId", "signalTime", "source", "status" FROM "TVAlertSignal";
DROP TABLE "TVAlertSignal";
ALTER TABLE "new_TVAlertSignal" RENAME TO "TVAlertSignal";
CREATE INDEX "TVAlertSignal_instrument_receivedAt_idx" ON "TVAlertSignal"("instrument", "receivedAt");
CREATE INDEX "TVAlertSignal_status_receivedAt_idx" ON "TVAlertSignal"("status", "receivedAt");
CREATE INDEX "TVAlertSignal_source_receivedAt_idx" ON "TVAlertSignal"("source", "receivedAt");
CREATE INDEX "TVAlertSignal_receivedAt_idx" ON "TVAlertSignal"("receivedAt");
CREATE INDEX "TVAlertSignal_resultTradeId_idx" ON "TVAlertSignal"("resultTradeId");
CREATE TABLE "new_TradeCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionParams" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "label" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "analysisId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "parentConditionId" TEXT,
    "expiresAt" DATETIME,
    "triggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TradeCondition_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeCondition_parentConditionId_fkey" FOREIGN KEY ("parentConditionId") REFERENCES "TradeCondition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TradeCondition" ("actionParams", "actionType", "analysisId", "createdAt", "createdBy", "expiresAt", "id", "label", "priority", "status", "tradeId", "triggerType", "triggerValue", "triggeredAt", "updatedAt") SELECT "actionParams", "actionType", "analysisId", "createdAt", "createdBy", "expiresAt", "id", "label", "priority", "status", "tradeId", "triggerType", "triggerValue", "triggeredAt", "updatedAt" FROM "TradeCondition";
DROP TABLE "TradeCondition";
ALTER TABLE "new_TradeCondition" RENAME TO "TradeCondition";
CREATE INDEX "TradeCondition_tradeId_status_idx" ON "TradeCondition"("tradeId", "status");
CREATE INDEX "TradeCondition_status_idx" ON "TradeCondition"("status");
CREATE INDEX "TradeCondition_triggerType_status_idx" ON "TradeCondition"("triggerType", "status");
CREATE INDEX "TradeCondition_parentConditionId_idx" ON "TradeCondition"("parentConditionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AiRecommendationOutcome_analysisId_idx" ON "AiRecommendationOutcome"("analysisId");

-- CreateIndex
CREATE INDEX "AiRecommendationOutcome_tradeId_idx" ON "AiRecommendationOutcome"("tradeId");

-- CreateIndex
CREATE INDEX "AiRecommendationOutcome_tradeOutcome_createdAt_idx" ON "AiRecommendationOutcome"("tradeOutcome", "createdAt");

-- CreateIndex
CREATE INDEX "AiDigest_period_periodStart_idx" ON "AiDigest"("period", "periodStart");

-- CreateIndex
CREATE INDEX "AiDigest_status_idx" ON "AiDigest"("status");

-- CreateIndex
CREATE INDEX "SignalAuditEvent_signalId_timestamp_idx" ON "SignalAuditEvent"("signalId", "timestamp");

-- CreateIndex
CREATE INDEX "SupplyDemandZone_instrument_timeframe_status_idx" ON "SupplyDemandZone"("instrument", "timeframe", "status");

-- CreateIndex
CREATE INDEX "SupplyDemandZone_instrument_timeframe_scoreTotal_idx" ON "SupplyDemandZone"("instrument", "timeframe", "scoreTotal");

-- CreateIndex
CREATE INDEX "SupplyDemandZone_status_idx" ON "SupplyDemandZone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyDemandZone_instrument_timeframe_baseStartTime_baseEndTime_type_key" ON "SupplyDemandZone"("instrument", "timeframe", "baseStartTime", "baseEndTime", "type");

-- CreateIndex
CREATE INDEX "DetectedTrend_instrument_timeframe_computedAt_idx" ON "DetectedTrend"("instrument", "timeframe", "computedAt");

-- CreateIndex
CREATE INDEX "DetectedTrend_instrument_timeframe_status_idx" ON "DetectedTrend"("instrument", "timeframe", "status");

-- CreateIndex
CREATE INDEX "CurveSnapshot_instrument_timeframe_computedAt_idx" ON "CurveSnapshot"("instrument", "timeframe", "computedAt");

-- CreateIndex
CREATE INDEX "AiTraderOpportunity_instrument_status_idx" ON "AiTraderOpportunity"("instrument", "status");

-- CreateIndex
CREATE INDEX "AiTraderOpportunity_status_confidence_idx" ON "AiTraderOpportunity"("status", "confidence");

-- CreateIndex
CREATE INDEX "AiTraderOpportunity_profile_status_idx" ON "AiTraderOpportunity"("profile", "status");

-- CreateIndex
CREATE INDEX "AiTraderOpportunity_detectedAt_idx" ON "AiTraderOpportunity"("detectedAt");

-- CreateIndex
CREATE INDEX "AiTraderOpportunity_resultTradeId_idx" ON "AiTraderOpportunity"("resultTradeId");

-- CreateIndex
CREATE INDEX "AiTraderMarketData_dataType_dataKey_expiresAt_idx" ON "AiTraderMarketData"("dataType", "dataKey", "expiresAt");

-- CreateIndex
CREATE INDEX "AiTraderMarketData_dataType_expiresAt_idx" ON "AiTraderMarketData"("dataType", "expiresAt");

-- CreateIndex
CREATE INDEX "AiTraderStrategyPerformance_profile_instrument_periodStart_idx" ON "AiTraderStrategyPerformance"("profile", "instrument", "periodStart");

-- CreateIndex
CREATE INDEX "AiTraderStrategyPerformance_profile_periodStart_idx" ON "AiTraderStrategyPerformance"("profile", "periodStart");
