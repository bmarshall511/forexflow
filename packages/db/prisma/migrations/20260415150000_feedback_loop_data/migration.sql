-- AlterTable
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "tier2Confidence" INTEGER;
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "tier2DecidedAt" DATETIME;
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "tier2Passed" BOOLEAN;

-- AlterTable
ALTER TABLE "SmartFlowTrade" ADD COLUMN "atrAtPlacement" REAL;
ALTER TABLE "SmartFlowTrade" ADD COLUMN "regimeAtPlacement" TEXT;

-- CreateTable
CREATE TABLE "AiTraderNearMiss" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "blockingFilter" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AiTraderNearMiss_detectedAt_idx" ON "AiTraderNearMiss"("detectedAt");

-- CreateIndex
CREATE INDEX "AiTraderNearMiss_instrument_detectedAt_idx" ON "AiTraderNearMiss"("instrument", "detectedAt");

-- CreateIndex
CREATE INDEX "AiTraderNearMiss_profile_detectedAt_idx" ON "AiTraderNearMiss"("profile", "detectedAt");

-- CreateIndex
CREATE INDEX "AiTraderNearMiss_blockingFilter_detectedAt_idx" ON "AiTraderNearMiss"("blockingFilter", "detectedAt");

