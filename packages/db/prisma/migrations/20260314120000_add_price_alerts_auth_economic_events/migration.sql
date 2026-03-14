-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "targetPrice" REAL NOT NULL,
    "currentPrice" REAL NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "repeating" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthPin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pinHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "sessionExpiry" INTEGER NOT NULL DEFAULT 86400,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "device" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EconomicEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "actual" TEXT,
    "forecast" TEXT,
    "previous" TEXT,
    "timestamp" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tradingMode" TEXT NOT NULL DEFAULT 'practice',
    "practiceToken" TEXT,
    "practiceAccountId" TEXT,
    "liveToken" TEXT,
    "liveAccountId" TEXT,
    "riskPercent" REAL NOT NULL DEFAULT 1.0,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("id", "liveAccountId", "liveToken", "practiceAccountId", "practiceToken", "riskPercent", "tradingMode", "updatedAt") SELECT "id", "liveAccountId", "liveToken", "practiceAccountId", "practiceToken", "riskPercent", "tradingMode", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PriceAlert_status_idx" ON "PriceAlert"("status");

-- CreateIndex
CREATE INDEX "PriceAlert_instrument_status_idx" ON "PriceAlert"("instrument", "status");

-- CreateIndex
CREATE INDEX "PriceAlert_expiresAt_idx" ON "PriceAlert"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "EconomicEvent_timestamp_idx" ON "EconomicEvent"("timestamp");

-- CreateIndex
CREATE INDEX "EconomicEvent_currency_timestamp_idx" ON "EconomicEvent"("currency", "timestamp");

-- CreateIndex
CREATE INDEX "EconomicEvent_impact_timestamp_idx" ON "EconomicEvent"("impact", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicEvent_title_timestamp_key" ON "EconomicEvent"("title", "timestamp");

-- CreateIndex
CREATE INDEX "TradeCondition_expiresAt_idx" ON "TradeCondition"("expiresAt");

-- CreateIndex
CREATE INDEX "TradeFinderSetup_placedAt_idx" ON "TradeFinderSetup"("placedAt");
