-- Add configurable ATR multiplier for risk-based sizing fallback
ALTER TABLE "TVAlertsConfig" ADD COLUMN "fallbackAtrMultiplier" REAL NOT NULL DEFAULT 1.5;
