-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceTradeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "orderType" TEXT,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL,
    "stopLoss" REAL,
    "takeProfit" REAL,
    "trailingStopDistance" REAL,
    "initialUnits" REAL NOT NULL,
    "currentUnits" REAL NOT NULL,
    "realizedPL" REAL NOT NULL DEFAULT 0,
    "unrealizedPL" REAL NOT NULL DEFAULT 0,
    "financing" REAL NOT NULL DEFAULT 0,
    "closeReason" TEXT,
    "timeInForce" TEXT,
    "gtdTime" TEXT,
    "mfe" REAL,
    "mae" REAL,
    "notes" TEXT,
    "metadata" TEXT,
    "openedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeEvent_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Trade_status_openedAt_idx" ON "Trade"("status", "openedAt");

-- CreateIndex
CREATE INDEX "Trade_status_closedAt_idx" ON "Trade"("status", "closedAt");

-- CreateIndex
CREATE INDEX "Trade_instrument_status_idx" ON "Trade"("instrument", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_source_sourceTradeId_key" ON "Trade"("source", "sourceTradeId");

-- CreateIndex
CREATE INDEX "TradeEvent_tradeId_createdAt_idx" ON "TradeEvent"("tradeId", "createdAt");
