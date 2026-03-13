-- Add metadata column to Notification table
ALTER TABLE "Notification" ADD COLUMN "metadata" TEXT;

-- Create AiSettings table
CREATE TABLE "AiSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "claudeApiKey" TEXT,
    "finnhubApiKey" TEXT,
    "defaultModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "autoAnalysisJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- Create AiAnalysis table
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "depth" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tradeStatus" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'user',
    "contextSnapshot" TEXT NOT NULL DEFAULT '{}',
    "rawResponse" TEXT,
    "sections" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiAnalysis_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create TradeCondition table
CREATE TABLE "TradeCondition" (
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
    "expiresAt" DATETIME,
    "triggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TradeCondition_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for AiAnalysis
CREATE INDEX "AiAnalysis_tradeId_createdAt_idx" ON "AiAnalysis"("tradeId", "createdAt");
CREATE INDEX "AiAnalysis_status_createdAt_idx" ON "AiAnalysis"("status", "createdAt");
CREATE INDEX "AiAnalysis_createdAt_idx" ON "AiAnalysis"("createdAt");

-- Create indexes for TradeCondition
CREATE INDEX "TradeCondition_tradeId_status_idx" ON "TradeCondition"("tradeId", "status");
CREATE INDEX "TradeCondition_status_idx" ON "TradeCondition"("status");
CREATE INDEX "TradeCondition_triggerType_status_idx" ON "TradeCondition"("triggerType", "status");
