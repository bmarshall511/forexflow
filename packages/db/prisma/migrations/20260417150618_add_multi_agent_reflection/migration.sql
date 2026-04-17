-- CreateTable
CREATE TABLE "AiTraderReflection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "realizedPL" REAL NOT NULL,
    "entryRationale" TEXT,
    "reflection" TEXT NOT NULL,
    "lessonsLearned" TEXT NOT NULL,
    "primaryTechnique" TEXT,
    "regime" TEXT,
    "session" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "closedAt" DATETIME NOT NULL,
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
    "multiAgentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fredApiKey" TEXT,
    "alphaVantageApiKey" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AiTraderConfig" ("alphaVantageApiKey", "confidenceThreshold", "dailyBudgetUsd", "decisionModel", "enabled", "enabledProfiles", "enabledTechniques", "fredApiKey", "id", "managementConfig", "maxConcurrentTrades", "minimumConfidence", "monthlyBudgetUsd", "operatingMode", "pairWhitelist", "reEvalIntervalMinutes", "scanIntervalMinutes", "scanModel", "updatedAt") SELECT "alphaVantageApiKey", "confidenceThreshold", "dailyBudgetUsd", "decisionModel", "enabled", "enabledProfiles", "enabledTechniques", "fredApiKey", "id", "managementConfig", "maxConcurrentTrades", "minimumConfidence", "monthlyBudgetUsd", "operatingMode", "pairWhitelist", "reEvalIntervalMinutes", "scanIntervalMinutes", "scanModel", "updatedAt" FROM "AiTraderConfig";
DROP TABLE "AiTraderConfig";
ALTER TABLE "new_AiTraderConfig" RENAME TO "AiTraderConfig";
CREATE TABLE "new_AiTraderOpportunity" (
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
    "tier2Model" TEXT,
    "tier2InputTokens" INTEGER NOT NULL DEFAULT 0,
    "tier2OutputTokens" INTEGER NOT NULL DEFAULT 0,
    "tier2Cost" REAL NOT NULL DEFAULT 0,
    "tier2Confidence" INTEGER,
    "tier2Passed" BOOLEAN,
    "tier2DecidedAt" DATETIME,
    "technicalBrief" TEXT,
    "macroRiskBrief" TEXT,
    "bullCase" TEXT,
    "bearCase" TEXT,
    "debateCost" REAL NOT NULL DEFAULT 0,
    "debateInputTokens" INTEGER NOT NULL DEFAULT 0,
    "debateOutputTokens" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_AiTraderOpportunity" ("closedAt", "confidence", "createdAt", "detectedAt", "direction", "entryPrice", "entryRationale", "expiresAt", "filledAt", "fundamentalSnapshot", "id", "instrument", "managementLog", "outcome", "placedAt", "positionSize", "primaryTechnique", "profile", "realizedPL", "regime", "resultSourceId", "resultTradeId", "rewardPips", "riskPips", "riskRewardRatio", "scoresJson", "sentimentSnapshot", "session", "status", "stopLoss", "suggestedAt", "takeProfit", "technicalSnapshot", "tier2Confidence", "tier2Cost", "tier2DecidedAt", "tier2InputTokens", "tier2Model", "tier2OutputTokens", "tier2Passed", "tier2Response", "tier3Cost", "tier3InputTokens", "tier3Model", "tier3OutputTokens", "tier3Response", "updatedAt") SELECT "closedAt", "confidence", "createdAt", "detectedAt", "direction", "entryPrice", "entryRationale", "expiresAt", "filledAt", "fundamentalSnapshot", "id", "instrument", "managementLog", "outcome", "placedAt", "positionSize", "primaryTechnique", "profile", "realizedPL", "regime", "resultSourceId", "resultTradeId", "rewardPips", "riskPips", "riskRewardRatio", "scoresJson", "sentimentSnapshot", "session", "status", "stopLoss", "suggestedAt", "takeProfit", "technicalSnapshot", "tier2Confidence", "tier2Cost", "tier2DecidedAt", "tier2InputTokens", "tier2Model", "tier2OutputTokens", "tier2Passed", "tier2Response", "tier3Cost", "tier3InputTokens", "tier3Model", "tier3OutputTokens", "tier3Response", "updatedAt" FROM "AiTraderOpportunity";
DROP TABLE "AiTraderOpportunity";
ALTER TABLE "new_AiTraderOpportunity" RENAME TO "AiTraderOpportunity";
CREATE INDEX "AiTraderOpportunity_instrument_status_idx" ON "AiTraderOpportunity"("instrument", "status");
CREATE INDEX "AiTraderOpportunity_status_confidence_idx" ON "AiTraderOpportunity"("status", "confidence");
CREATE INDEX "AiTraderOpportunity_profile_status_idx" ON "AiTraderOpportunity"("profile", "status");
CREATE INDEX "AiTraderOpportunity_detectedAt_idx" ON "AiTraderOpportunity"("detectedAt");
CREATE INDEX "AiTraderOpportunity_status_detectedAt_idx" ON "AiTraderOpportunity"("status", "detectedAt");
CREATE INDEX "AiTraderOpportunity_resultTradeId_idx" ON "AiTraderOpportunity"("resultTradeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AiTraderReflection_opportunityId_key" ON "AiTraderReflection"("opportunityId");

-- CreateIndex
CREATE INDEX "AiTraderReflection_instrument_profile_createdAt_idx" ON "AiTraderReflection"("instrument", "profile", "createdAt");

-- CreateIndex
CREATE INDEX "AiTraderReflection_profile_outcome_createdAt_idx" ON "AiTraderReflection"("profile", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "AiTraderReflection_createdAt_idx" ON "AiTraderReflection"("createdAt");
