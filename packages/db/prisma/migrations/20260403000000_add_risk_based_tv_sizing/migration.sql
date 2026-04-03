-- Add risk-based position sizing fields to TVAlertsConfig
ALTER TABLE "TVAlertsConfig" ADD COLUMN "riskPercent" REAL NOT NULL DEFAULT 1.0;
ALTER TABLE "TVAlertsConfig" ADD COLUMN "minUnits" INTEGER NOT NULL DEFAULT 1000;
