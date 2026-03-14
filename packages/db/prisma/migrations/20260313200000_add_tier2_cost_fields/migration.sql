-- AlterTable: Add tier2 cost tracking fields to AiTraderOpportunity
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "tier2Model" TEXT;
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "tier2InputTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "tier2OutputTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiTraderOpportunity" ADD COLUMN "tier2Cost" REAL NOT NULL DEFAULT 0;
