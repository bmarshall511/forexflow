-- CreateTable
CREATE TABLE IF NOT EXISTS "TVAlertsManagementConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "breakevenEnabled" BOOLEAN NOT NULL DEFAULT true,
    "breakevenRR" REAL NOT NULL DEFAULT 1.0,
    "breakevenBufferPips" REAL NOT NULL DEFAULT 2.0,
    "trailingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trailingAtrMultiple" REAL NOT NULL DEFAULT 1.0,
    "trailingStepPips" REAL NOT NULL DEFAULT 2.0,
    "partialCloseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "partialCloseStrategy" TEXT NOT NULL DEFAULT 'thirds',
    "partialCloseRR" REAL NOT NULL DEFAULT 1.0,
    "partialClosePercent" REAL NOT NULL DEFAULT 33.0,
    "timeExitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timeExitHours" REAL NOT NULL DEFAULT 8.0,
    "timeExitMinRR" REAL NOT NULL DEFAULT 0.5,
    "whipsawDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whipsawWindowHours" REAL NOT NULL DEFAULT 4.0,
    "whipsawMaxSignals" INTEGER NOT NULL DEFAULT 3,
    "whipsawCooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable: add AI filter columns to TVAlertsConfig
ALTER TABLE "TVAlertsConfig" ADD COLUMN "aiFilterEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TVAlertsConfig" ADD COLUMN "aiFilterMinConfidence" INTEGER NOT NULL DEFAULT 60;
