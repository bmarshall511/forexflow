-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SmartFlowTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "tradeId" TEXT,
    "sourceTradeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting_entry',
    "entryPrice" REAL,
    "currentPhase" TEXT NOT NULL DEFAULT 'entry',
    "breakevenTriggered" BOOLEAN NOT NULL DEFAULT false,
    "trailingActivated" BOOLEAN NOT NULL DEFAULT false,
    "partialCloseLogJson" TEXT NOT NULL DEFAULT '[]',
    "managementLogJson" TEXT NOT NULL DEFAULT '[]',
    "recoveryLevel" INTEGER NOT NULL DEFAULT 0,
    "recoveryTradeIds" TEXT NOT NULL DEFAULT '[]',
    "lastManagementAction" TEXT,
    "estimatedHours" REAL,
    "estimatedLow" REAL,
    "estimatedHigh" REAL,
    "safetyNetTriggered" TEXT,
    "financingAccumulated" REAL NOT NULL DEFAULT 0,
    "entrySpread" REAL,
    "avgSpread" REAL,
    "aiActionsToday" INTEGER NOT NULL DEFAULT 0,
    "aiLastActionAt" DATETIME,
    "aiTotalCost" REAL NOT NULL DEFAULT 0,
    "aiTotalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "aiTotalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "aiSuggestionsLogJson" TEXT NOT NULL DEFAULT '[]',
    "lastManualOverrideAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmartFlowTrade_configId_fkey" FOREIGN KEY ("configId") REFERENCES "SmartFlowConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmartFlowTrade_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SmartFlowTrade" ("aiActionsToday", "aiLastActionAt", "aiSuggestionsLogJson", "aiTotalCost", "aiTotalInputTokens", "aiTotalOutputTokens", "avgSpread", "breakevenTriggered", "closedAt", "configId", "createdAt", "currentPhase", "entryPrice", "entrySpread", "estimatedHigh", "estimatedHours", "estimatedLow", "financingAccumulated", "id", "lastManualOverrideAt", "managementLogJson", "partialCloseLogJson", "recoveryLevel", "recoveryTradeIds", "safetyNetTriggered", "sourceTradeId", "status", "tradeId", "trailingActivated", "updatedAt") SELECT "aiActionsToday", "aiLastActionAt", "aiSuggestionsLogJson", "aiTotalCost", "aiTotalInputTokens", "aiTotalOutputTokens", "avgSpread", "breakevenTriggered", "closedAt", "configId", "createdAt", "currentPhase", "entryPrice", "entrySpread", "estimatedHigh", "estimatedHours", "estimatedLow", "financingAccumulated", "id", "lastManualOverrideAt", "managementLogJson", "partialCloseLogJson", "recoveryLevel", "recoveryTradeIds", "safetyNetTriggered", "sourceTradeId", "status", "tradeId", "trailingActivated", "updatedAt" FROM "SmartFlowTrade";
DROP TABLE "SmartFlowTrade";
ALTER TABLE "new_SmartFlowTrade" RENAME TO "SmartFlowTrade";
CREATE INDEX "SmartFlowTrade_configId_idx" ON "SmartFlowTrade"("configId");
CREATE INDEX "SmartFlowTrade_status_idx" ON "SmartFlowTrade"("status");
CREATE INDEX "SmartFlowTrade_status_createdAt_idx" ON "SmartFlowTrade"("status", "createdAt");
CREATE INDEX "SmartFlowTrade_configId_status_idx" ON "SmartFlowTrade"("configId", "status");
CREATE INDEX "SmartFlowTrade_tradeId_idx" ON "SmartFlowTrade"("tradeId");
CREATE INDEX "SmartFlowTrade_sourceTradeId_idx" ON "SmartFlowTrade"("sourceTradeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

