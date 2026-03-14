/**
 * TradingView Alerts config service — manages webhook configuration and trading parameters.
 *
 * Handles the webhook token, position sizing, cooldown, pair whitelist,
 * market hours filter, and Cloudflare Worker connection settings.
 * Uses a singleton row (id=1) for app-wide TV alert config.
 *
 * @module tv-alerts-config-service
 */
import { randomBytes } from "node:crypto"
import { db } from "./client"
import type { TVAlertsConfig } from "@fxflow/types"
import { TV_ALERTS_DEFAULT_CONFIG } from "@fxflow/types"

/** Map a DB row to the TVAlertsConfig interface */
function rowToConfig(row: {
  enabled: boolean
  webhookToken: string
  positionSizePercent: number
  cooldownSeconds: number
  maxOpenPositions: number
  dailyLossLimit: number
  pairWhitelist: string
  marketHoursFilter: boolean
  dedupWindowSeconds: number
  showChartMarkers: boolean
  soundEnabled: boolean
  cfWorkerUrl: string
  cfWorkerSecret: string
}): TVAlertsConfig {
  let pairWhitelist: string[]
  try {
    pairWhitelist = JSON.parse(row.pairWhitelist) as string[]
  } catch {
    pairWhitelist = []
  }

  return {
    enabled: row.enabled,
    webhookToken: row.webhookToken,
    positionSizePercent: row.positionSizePercent,
    cooldownSeconds: row.cooldownSeconds,
    maxOpenPositions: row.maxOpenPositions,
    dailyLossLimit: row.dailyLossLimit,
    pairWhitelist,
    marketHoursFilter: row.marketHoursFilter,
    dedupWindowSeconds: row.dedupWindowSeconds,
    showChartMarkers: row.showChartMarkers,
    soundEnabled: row.soundEnabled,
    cfWorkerUrl: row.cfWorkerUrl,
    cfWorkerSecret: row.cfWorkerSecret,
  }
}

/** Get the TV Alerts config, or return defaults if none exists. */
export async function getTVAlertsConfig(): Promise<TVAlertsConfig> {
  const row = await db.tVAlertsConfig.findUnique({ where: { id: 1 } })
  if (!row) return { ...TV_ALERTS_DEFAULT_CONFIG }
  return rowToConfig(row)
}

/** Update TV Alerts config (partial update, upserts). */
export async function updateTVAlertsConfig(
  input: Partial<TVAlertsConfig>,
): Promise<TVAlertsConfig> {
  const updateData: Record<string, unknown> = {}

  if (input.enabled !== undefined) updateData.enabled = input.enabled
  if (input.webhookToken !== undefined) updateData.webhookToken = input.webhookToken
  if (input.positionSizePercent !== undefined)
    updateData.positionSizePercent = input.positionSizePercent
  if (input.cooldownSeconds !== undefined) updateData.cooldownSeconds = input.cooldownSeconds
  if (input.maxOpenPositions !== undefined) updateData.maxOpenPositions = input.maxOpenPositions
  if (input.dailyLossLimit !== undefined) updateData.dailyLossLimit = input.dailyLossLimit
  if (input.pairWhitelist !== undefined)
    updateData.pairWhitelist = JSON.stringify(input.pairWhitelist)
  if (input.marketHoursFilter !== undefined) updateData.marketHoursFilter = input.marketHoursFilter
  if (input.dedupWindowSeconds !== undefined)
    updateData.dedupWindowSeconds = input.dedupWindowSeconds
  if (input.showChartMarkers !== undefined) updateData.showChartMarkers = input.showChartMarkers
  if (input.soundEnabled !== undefined) updateData.soundEnabled = input.soundEnabled
  if (input.cfWorkerUrl !== undefined) updateData.cfWorkerUrl = input.cfWorkerUrl
  if (input.cfWorkerSecret !== undefined) updateData.cfWorkerSecret = input.cfWorkerSecret

  const row = await db.tVAlertsConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...updateData,
      pairWhitelist:
        (updateData.pairWhitelist as string) ??
        JSON.stringify(TV_ALERTS_DEFAULT_CONFIG.pairWhitelist),
    },
    update: updateData,
  })

  return rowToConfig(row)
}

/** Generate a cryptographically random webhook token (32-char hex). */
export async function generateWebhookToken(): Promise<string> {
  const token = randomBytes(16).toString("hex")
  await updateTVAlertsConfig({ webhookToken: token })
  return token
}

/** Quick toggle for the kill switch. */
export async function setTVAlertsKillSwitch(enabled: boolean): Promise<void> {
  await updateTVAlertsConfig({ enabled })
}
