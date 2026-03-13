-- Add global risk percent to Settings
ALTER TABLE "Settings" ADD COLUMN "riskPercent" REAL NOT NULL DEFAULT 1.0;

-- CreateTable
CREATE TABLE "TradeFinderConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minScore" REAL NOT NULL DEFAULT 7.0,
    "maxEnabledPairs" INTEGER NOT NULL DEFAULT 10,
    "approachingAtrMultiple" REAL NOT NULL DEFAULT 1.5,
    "autoTradeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pairsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradeFinderSetup" (
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
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TradeFinderSetup_instrument_status_idx" ON "TradeFinderSetup"("instrument", "status");

-- CreateIndex
CREATE INDEX "TradeFinderSetup_status_scoreTotal_idx" ON "TradeFinderSetup"("status", "scoreTotal");

-- CreateIndex
CREATE INDEX "TradeFinderSetup_status_detectedAt_idx" ON "TradeFinderSetup"("status", "detectedAt");
