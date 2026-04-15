-- Add truncation tracking to AiAnalysis
-- `truncated` flags responses cut off by max_tokens
-- `stopReason` stores the Anthropic API stop_reason for observability
ALTER TABLE "AiAnalysis" ADD COLUMN "truncated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiAnalysis" ADD COLUMN "stopReason" TEXT;
