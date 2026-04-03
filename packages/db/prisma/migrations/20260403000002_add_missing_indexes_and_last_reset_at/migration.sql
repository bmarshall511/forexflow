-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "lastResetAt" DATETIME;

-- CreateIndex
CREATE INDEX "AiTraderOpportunity_status_detectedAt_idx" ON "AiTraderOpportunity"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "SmartFlowTrade_status_createdAt_idx" ON "SmartFlowTrade"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SmartFlowTrade_configId_status_idx" ON "SmartFlowTrade"("configId", "status");

-- CreateIndex
CREATE INDEX "SupplyDemandZone_lastConfirmedAt_idx" ON "SupplyDemandZone"("lastConfirmedAt");

-- CreateIndex
CREATE INDEX "SupplyDemandZone_lastScoredAt_idx" ON "SupplyDemandZone"("lastScoredAt");

-- CreateIndex
CREATE INDEX "TVAlertSignal_processedAt_idx" ON "TVAlertSignal"("processedAt");

-- CreateIndex
CREATE INDEX "Trade_updatedAt_idx" ON "Trade"("updatedAt");
