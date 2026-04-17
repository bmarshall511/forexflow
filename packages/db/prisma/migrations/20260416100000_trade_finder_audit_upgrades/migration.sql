-- Trade Finder audit upgrades: new scoring dimensions, entry depth, session preference, AI management

-- AlterTable: add new columns to TradeFinderSetup
ALTER TABLE "TradeFinderSetup" ADD COLUMN "arrivalSpeed" TEXT;
ALTER TABLE "TradeFinderSetup" ADD COLUMN "detectionSession" TEXT;
ALTER TABLE "TradeFinderSetup" ADD COLUMN "theoreticalOutcomeJson" TEXT;

-- RedefineTables: add new columns to TradeFinderConfig (SQLite requires table recreation for NOT NULL with defaults)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "entryDepthPercent" REAL NOT NULL DEFAULT 25,
    "sessionPreference" TEXT NOT NULL DEFAULT 'kill_zones',
    "aiManagedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pairsJson" TEXT NOT NULL DEFAULT '[]',
    "dimensionWeightsJson" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TradeFinderConfig" ("approachingAtrMultiple", "autoTradeCancelOnInvalidation", "autoTradeEnabled", "autoTradeMaxConcurrent", "autoTradeMaxDaily", "autoTradeMaxRiskPercent", "autoTradeMinRR", "autoTradeMinScore", "breakevenEnabled", "confirmationTimeout", "enabled", "entryConfirmation", "id", "maxEnabledPairs", "minScore", "pairsJson", "partialCloseEnabled", "partialClosePercent", "partialCloseRR", "partialExitStrategy", "shadowMode", "smartSizing", "timeExitCandles", "timeExitEnabled", "trailingStopCandles", "trailingStopEnabled", "updatedAt") SELECT "approachingAtrMultiple", "autoTradeCancelOnInvalidation", "autoTradeEnabled", "autoTradeMaxConcurrent", "autoTradeMaxDaily", "autoTradeMaxRiskPercent", "autoTradeMinRR", "autoTradeMinScore", "breakevenEnabled", "confirmationTimeout", "enabled", "entryConfirmation", "id", "maxEnabledPairs", "minScore", "pairsJson", "partialCloseEnabled", "partialClosePercent", "partialCloseRR", "partialExitStrategy", "shadowMode", "smartSizing", "timeExitCandles", "timeExitEnabled", "trailingStopCandles", "trailingStopEnabled", "updatedAt" FROM "TradeFinderConfig";
DROP TABLE "TradeFinderConfig";
ALTER TABLE "new_TradeFinderConfig" RENAME TO "TradeFinderConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
