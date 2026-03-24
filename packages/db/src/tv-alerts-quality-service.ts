/**
 * TradingView Alerts quality/confluence config service — manages signal quality
 * engine settings including confluence filters, SL/TP, and dynamic sizing.
 *
 * Uses a singleton row (id=1) for app-wide quality config.
 *
 * @module tv-alerts-quality-service
 */
import { db } from "./client"
import type { TVAlertsQualityConfig } from "@fxflow/types"
import { TV_ALERTS_QUALITY_DEFAULT_CONFIG } from "@fxflow/types"

/** Map a DB row to the TVAlertsQualityConfig interface. */
function rowToConfig(row: {
  enabled: boolean
  minScore: number
  trendFilter: boolean
  trendWeight: number
  momentumFilter: boolean
  momentumWeight: number
  volatilityFilter: boolean
  volatilityWeight: number
  htfFilter: boolean
  htfWeight: number
  sessionFilter: boolean
  sessionWeight: number
  autoSL: boolean
  slAtrMultiplier: number
  autoTP: boolean
  tpRiskRewardRatio: number
  dynamicSizing: boolean
  highConfThreshold: number
  highConfMultiplier: number
  lowConfThreshold: number
  lowConfMultiplier: number
}): TVAlertsQualityConfig {
  return {
    enabled: row.enabled,
    minScore: row.minScore,
    trendFilter: row.trendFilter,
    trendWeight: row.trendWeight,
    momentumFilter: row.momentumFilter,
    momentumWeight: row.momentumWeight,
    volatilityFilter: row.volatilityFilter,
    volatilityWeight: row.volatilityWeight,
    htfFilter: row.htfFilter,
    htfWeight: row.htfWeight,
    sessionFilter: row.sessionFilter,
    sessionWeight: row.sessionWeight,
    autoSL: row.autoSL,
    slAtrMultiplier: row.slAtrMultiplier,
    autoTP: row.autoTP,
    tpRiskRewardRatio: row.tpRiskRewardRatio,
    dynamicSizing: row.dynamicSizing,
    highConfThreshold: row.highConfThreshold,
    highConfMultiplier: row.highConfMultiplier,
    lowConfThreshold: row.lowConfThreshold,
    lowConfMultiplier: row.lowConfMultiplier,
  }
}

/** Get the quality config, or return defaults if none exists. */
export async function getTVAlertsQualityConfig(): Promise<TVAlertsQualityConfig> {
  const row = await db.tVAlertsQualityConfig.findUnique({ where: { id: 1 } })
  if (!row) return { ...TV_ALERTS_QUALITY_DEFAULT_CONFIG }
  return rowToConfig(row)
}

/** Update quality config (partial update, upserts). */
export async function updateTVAlertsQualityConfig(
  input: Partial<TVAlertsQualityConfig>,
): Promise<TVAlertsQualityConfig> {
  const updateData: Record<string, unknown> = {}

  if (input.enabled !== undefined) updateData.enabled = input.enabled
  if (input.minScore !== undefined) updateData.minScore = input.minScore
  if (input.trendFilter !== undefined) updateData.trendFilter = input.trendFilter
  if (input.trendWeight !== undefined) updateData.trendWeight = input.trendWeight
  if (input.momentumFilter !== undefined) updateData.momentumFilter = input.momentumFilter
  if (input.momentumWeight !== undefined) updateData.momentumWeight = input.momentumWeight
  if (input.volatilityFilter !== undefined) updateData.volatilityFilter = input.volatilityFilter
  if (input.volatilityWeight !== undefined) updateData.volatilityWeight = input.volatilityWeight
  if (input.htfFilter !== undefined) updateData.htfFilter = input.htfFilter
  if (input.htfWeight !== undefined) updateData.htfWeight = input.htfWeight
  if (input.sessionFilter !== undefined) updateData.sessionFilter = input.sessionFilter
  if (input.sessionWeight !== undefined) updateData.sessionWeight = input.sessionWeight
  if (input.autoSL !== undefined) updateData.autoSL = input.autoSL
  if (input.slAtrMultiplier !== undefined) updateData.slAtrMultiplier = input.slAtrMultiplier
  if (input.autoTP !== undefined) updateData.autoTP = input.autoTP
  if (input.tpRiskRewardRatio !== undefined) updateData.tpRiskRewardRatio = input.tpRiskRewardRatio
  if (input.dynamicSizing !== undefined) updateData.dynamicSizing = input.dynamicSizing
  if (input.highConfThreshold !== undefined) updateData.highConfThreshold = input.highConfThreshold
  if (input.highConfMultiplier !== undefined)
    updateData.highConfMultiplier = input.highConfMultiplier
  if (input.lowConfThreshold !== undefined) updateData.lowConfThreshold = input.lowConfThreshold
  if (input.lowConfMultiplier !== undefined) updateData.lowConfMultiplier = input.lowConfMultiplier

  const row = await db.tVAlertsQualityConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...updateData },
    update: updateData,
  })

  return rowToConfig(row)
}
