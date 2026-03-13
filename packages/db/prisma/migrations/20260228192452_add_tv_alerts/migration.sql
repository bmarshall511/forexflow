-- CreateTable
CREATE TABLE "TVAlertsConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookToken" TEXT NOT NULL DEFAULT '',
    "positionSizePercent" REAL NOT NULL DEFAULT 1.0,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "maxOpenPositions" INTEGER NOT NULL DEFAULT 3,
    "dailyLossLimit" REAL NOT NULL DEFAULT 0,
    "pairWhitelist" TEXT NOT NULL DEFAULT '[]',
    "marketHoursFilter" BOOLEAN NOT NULL DEFAULT true,
    "dedupWindowSeconds" INTEGER NOT NULL DEFAULT 5,
    "showChartMarkers" BOOLEAN NOT NULL DEFAULT true,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TVAlertSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'ut_bot_alerts',
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "rawPayload" TEXT NOT NULL,
    "resultTradeId" TEXT,
    "executionDetails" TEXT,
    "receivedAt" DATETIME NOT NULL,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TVAlertSignal_instrument_receivedAt_idx" ON "TVAlertSignal"("instrument", "receivedAt");

-- CreateIndex
CREATE INDEX "TVAlertSignal_status_receivedAt_idx" ON "TVAlertSignal"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "TVAlertSignal_source_receivedAt_idx" ON "TVAlertSignal"("source", "receivedAt");

-- CreateIndex
CREATE INDEX "TVAlertSignal_receivedAt_idx" ON "TVAlertSignal"("receivedAt");
