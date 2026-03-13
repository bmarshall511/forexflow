-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TVAlertsConfig" (
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
    "cfWorkerUrl" TEXT NOT NULL DEFAULT '',
    "cfWorkerSecret" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TVAlertsConfig" ("cooldownSeconds", "dailyLossLimit", "dedupWindowSeconds", "enabled", "id", "marketHoursFilter", "maxOpenPositions", "pairWhitelist", "positionSizePercent", "showChartMarkers", "soundEnabled", "updatedAt", "webhookToken") SELECT "cooldownSeconds", "dailyLossLimit", "dedupWindowSeconds", "enabled", "id", "marketHoursFilter", "maxOpenPositions", "pairWhitelist", "positionSizePercent", "showChartMarkers", "soundEnabled", "updatedAt", "webhookToken" FROM "TVAlertsConfig";
DROP TABLE "TVAlertsConfig";
ALTER TABLE "new_TVAlertsConfig" RENAME TO "TVAlertsConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
