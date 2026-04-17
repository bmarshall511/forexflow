-- AI Analysis lifecycle v2: resilience, reconciliation, cost accounting
--
-- Adds the columns + tables required for:
--   * Partial-stream preservation on cancel (AiAnalysis.partialStreamText)
--   * Cancellation timestamp + schema versioning (AiAnalysis.cancelledAt, schemaVersion)
--   * Reconciliation log for re-runs (AiAnalysis.reconciliationLog)
--   * Prompt caching token accounting (AiAnalysis.cacheReadTokens, cacheWriteTokens)
--   * AiImmediateActionLog — lifecycle tracking for the immediate-actions list
--     returned inside analysis JSON, so re-runs can reconcile them
--   * TradeCondition soft-delete (deletedAt) + lastModifiedAt + expiredNotified
--   * AiSettings fields for auto-retry, monthly budget cap, reanalysis schedule,
--     and max reconciliation ops guardrail
--
-- All new columns are nullable or defaulted. Non-destructive: existing rows
-- keep working unchanged, new code paths gate behavior on the new fields.

-- ─── AiSettings ─────────────────────────────────────────────────────────────
ALTER TABLE "AiSettings" ADD COLUMN "autoRetryInterrupted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiSettings" ADD COLUMN "monthlyBudgetCapUsd" REAL;
ALTER TABLE "AiSettings" ADD COLUMN "maxReconciliationOps" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "AiSettings" ADD COLUMN "reanalysisScheduleJson" TEXT NOT NULL DEFAULT '{}';

-- ─── AiAnalysis ─────────────────────────────────────────────────────────────
ALTER TABLE "AiAnalysis" ADD COLUMN "cacheReadTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiAnalysis" ADD COLUMN "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiAnalysis" ADD COLUMN "partialStreamText" TEXT;
ALTER TABLE "AiAnalysis" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "AiAnalysis" ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AiAnalysis" ADD COLUMN "reconciliationLog" TEXT;

CREATE INDEX "AiAnalysis_status_updatedAt_idx" ON "AiAnalysis"("status", "updatedAt");

-- ─── TradeCondition ─────────────────────────────────────────────────────────
ALTER TABLE "TradeCondition" ADD COLUMN "lastModifiedAt" DATETIME;
ALTER TABLE "TradeCondition" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "TradeCondition" ADD COLUMN "expiredNotified" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "TradeCondition_tradeId_deletedAt_idx" ON "TradeCondition"("tradeId", "deletedAt");

-- ─── AiImmediateActionLog (new) ─────────────────────────────────────────────
CREATE TABLE "AiImmediateActionLog" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "tradeId"      TEXT NOT NULL,
  "analysisId"   TEXT NOT NULL,
  "actionType"   TEXT NOT NULL,
  "actionParams" TEXT NOT NULL DEFAULT '{}',
  "status"       TEXT NOT NULL DEFAULT 'proposed',
  "resolvedAt"   DATETIME,
  "resolvedNote" TEXT,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AiImmediateActionLog_tradeId_analysisId_idx"
  ON "AiImmediateActionLog"("tradeId", "analysisId");
CREATE INDEX "AiImmediateActionLog_tradeId_status_idx"
  ON "AiImmediateActionLog"("tradeId", "status");
CREATE INDEX "AiImmediateActionLog_analysisId_idx"
  ON "AiImmediateActionLog"("analysisId");
