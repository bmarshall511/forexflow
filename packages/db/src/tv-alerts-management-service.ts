/**
 * TV Alerts Management Config service — manages the singleton (id=1) row
 * for post-entry trade management settings (breakeven, trailing, partial close,
 * time exit, whipsaw detection).
 *
 * @module tv-alerts-management-service
 */
import { db } from "./client"
import type { TVAlertsManagementConfig } from "@fxflow/types"
import { TV_ALERTS_MANAGEMENT_DEFAULTS } from "@fxflow/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreate() {
  const existing = await db.tVAlertsManagementConfig.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return db.tVAlertsManagementConfig.create({ data: { id: 1 } })
}

function rowToConfig(row: Awaited<ReturnType<typeof getOrCreate>>): TVAlertsManagementConfig {
  return {
    breakevenEnabled: row.breakevenEnabled,
    breakevenRR: row.breakevenRR,
    breakevenBufferPips: row.breakevenBufferPips,
    trailingEnabled: row.trailingEnabled,
    trailingAtrMultiple: row.trailingAtrMultiple,
    trailingStepPips: row.trailingStepPips,
    partialCloseEnabled: row.partialCloseEnabled,
    partialCloseStrategy:
      row.partialCloseStrategy as TVAlertsManagementConfig["partialCloseStrategy"],
    partialCloseRR: row.partialCloseRR,
    partialClosePercent: row.partialClosePercent,
    timeExitEnabled: row.timeExitEnabled,
    timeExitHours: row.timeExitHours,
    timeExitMinRR: row.timeExitMinRR,
    whipsawDetectionEnabled: row.whipsawDetectionEnabled,
    whipsawWindowHours: row.whipsawWindowHours,
    whipsawMaxSignals: row.whipsawMaxSignals,
    whipsawCooldownMinutes: row.whipsawCooldownMinutes,
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getTVAlertsManagementConfig(): Promise<TVAlertsManagementConfig> {
  const row = await getOrCreate()
  return rowToConfig(row)
}

export async function updateTVAlertsManagementConfig(
  updates: Partial<TVAlertsManagementConfig>,
): Promise<TVAlertsManagementConfig> {
  await getOrCreate()
  const row = await db.tVAlertsManagementConfig.update({
    where: { id: 1 },
    data: updates,
  })
  return rowToConfig(row)
}

export { TV_ALERTS_MANAGEMENT_DEFAULTS }
