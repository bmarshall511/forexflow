/**
 * Deployment settings service — manages deployment mode and cloud daemon URL.
 *
 * @module deployment-service
 */
import { db } from "./client"
import type { DeploymentMode } from "@fxflow/shared"

/** Deployment settings DTO returned to callers. */
export interface DeploymentSettings {
  mode: DeploymentMode
  cloudDaemonUrl: string | null
}

/** Get the singleton settings row, creating it with defaults if it does not exist. */
async function getOrCreateSettings() {
  const existing = await db.settings.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return db.settings.create({ data: { id: 1 } })
}

/**
 * Get the current deployment mode and cloud daemon URL.
 */
export async function getDeploymentSettings(): Promise<DeploymentSettings> {
  const settings = await getOrCreateSettings()
  return {
    mode: (settings.deploymentMode as DeploymentMode) || "local",
    cloudDaemonUrl: settings.cloudDaemonUrl,
  }
}

/**
 * Update deployment mode.
 * @param mode — "local" or "cloud"
 */
export async function setDeploymentMode(mode: DeploymentMode): Promise<void> {
  await getOrCreateSettings()
  await db.settings.update({
    where: { id: 1 },
    data: { deploymentMode: mode },
  })
}

/**
 * Save the cloud daemon URL (used when deployment mode is "cloud").
 * @param url — Remote daemon URL (e.g. https://daemon.railway.app)
 */
export async function setCloudDaemonUrl(url: string | null): Promise<void> {
  await getOrCreateSettings()
  await db.settings.update({
    where: { id: 1 },
    data: { cloudDaemonUrl: url },
  })
}
