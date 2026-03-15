-- Add deployment mode settings for local vs cloud operation
ALTER TABLE "Settings" ADD COLUMN "deploymentMode" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "Settings" ADD COLUMN "cloudDaemonUrl" TEXT;
