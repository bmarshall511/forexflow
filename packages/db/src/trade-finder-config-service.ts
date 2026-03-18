/**
 * Trade Finder config service — manages scanner and auto-trade configuration.
 *
 * Handles enabled pairs, score thresholds, approaching ATR multiples,
 * and auto-trade settings (concurrent limits, risk caps, min R:R).
 * Uses a singleton row (id=1) for app-wide config.
 *
 * @module trade-finder-config-service
 */
import { db } from "./client"
import type { TradeFinderConfigData, TradeFinderPairConfig } from "@fxflow/types"
import { getRiskPercent } from "./settings-service"

/** Safely convert a Prisma date (may be invalid with libsql adapter) to ISO string */
function safeIso(val: unknown): string {
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString()
  if (typeof val === "string" && val) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  if (typeof val === "number") return new Date(val).toISOString()
  return new Date().toISOString()
}

/** Get the singleton config row, creating it with defaults if it does not exist. */
async function getOrCreateConfig() {
  const existing = await db.tradeFinderConfig.findUnique({ where: { id: 1 } })
  if (existing) return existing

  return db.tradeFinderConfig.create({ data: { id: 1 } })
}

/**
 * Get the current Trade Finder configuration including risk percent from global settings.
 *
 * @returns Full Trade Finder config data
 */
export async function getTradeFinderConfig(): Promise<TradeFinderConfigData> {
  const config = await getOrCreateConfig()
  const riskPercent = await getRiskPercent()

  let pairs: TradeFinderPairConfig[] = []
  try {
    pairs = JSON.parse(config.pairsJson) as TradeFinderPairConfig[]
  } catch {
    pairs = []
  }

  return {
    enabled: config.enabled,
    minScore: config.minScore,
    riskPercent,
    maxEnabledPairs: config.maxEnabledPairs,
    pairs,
    approachingAtrMultiple: config.approachingAtrMultiple,
    autoTradeEnabled: config.autoTradeEnabled,
    autoTradeMinScore: config.autoTradeMinScore,
    autoTradeMaxConcurrent: config.autoTradeMaxConcurrent,
    autoTradeMaxDaily: config.autoTradeMaxDaily,
    autoTradeMaxRiskPercent: config.autoTradeMaxRiskPercent,
    autoTradeMinRR: config.autoTradeMinRR,
    autoTradeCancelOnInvalidation: config.autoTradeCancelOnInvalidation,
    smartSizing: config.smartSizing,
    entryConfirmation: config.entryConfirmation,
    confirmationTimeout: config.confirmationTimeout,
    updatedAt: safeIso(config.updatedAt),
  }
}

/** Subset of Trade Finder config fields that can be updated via the API. */
type UpdatableConfigFields = Pick<
  TradeFinderConfigData,
  | "enabled"
  | "minScore"
  | "maxEnabledPairs"
  | "approachingAtrMultiple"
  | "autoTradeEnabled"
  | "autoTradeMinScore"
  | "autoTradeMaxConcurrent"
  | "autoTradeMaxDaily"
  | "autoTradeMaxRiskPercent"
  | "autoTradeMinRR"
  | "autoTradeCancelOnInvalidation"
  | "smartSizing"
  | "entryConfirmation"
  | "confirmationTimeout"
>

/**
 * Partially update the Trade Finder configuration. Only provided fields are updated.
 *
 * @param data - Fields to update, including optional pairs array
 * @returns The full updated config data
 */
export async function updateTradeFinderConfig(
  data: Partial<UpdatableConfigFields> & { pairs?: TradeFinderPairConfig[] },
): Promise<TradeFinderConfigData> {
  await getOrCreateConfig()

  const updateData: Record<string, unknown> = {}
  if (data.enabled !== undefined) updateData.enabled = data.enabled
  if (data.minScore !== undefined) updateData.minScore = data.minScore
  if (data.maxEnabledPairs !== undefined) updateData.maxEnabledPairs = data.maxEnabledPairs
  if (data.approachingAtrMultiple !== undefined)
    updateData.approachingAtrMultiple = data.approachingAtrMultiple
  if (data.autoTradeEnabled !== undefined) updateData.autoTradeEnabled = data.autoTradeEnabled
  if (data.autoTradeMinScore !== undefined) updateData.autoTradeMinScore = data.autoTradeMinScore
  if (data.autoTradeMaxConcurrent !== undefined)
    updateData.autoTradeMaxConcurrent = data.autoTradeMaxConcurrent
  if (data.autoTradeMaxDaily !== undefined) updateData.autoTradeMaxDaily = data.autoTradeMaxDaily
  if (data.autoTradeMaxRiskPercent !== undefined)
    updateData.autoTradeMaxRiskPercent = data.autoTradeMaxRiskPercent
  if (data.autoTradeMinRR !== undefined) updateData.autoTradeMinRR = data.autoTradeMinRR
  if (data.autoTradeCancelOnInvalidation !== undefined)
    updateData.autoTradeCancelOnInvalidation = data.autoTradeCancelOnInvalidation
  if (data.smartSizing !== undefined) updateData.smartSizing = data.smartSizing
  if (data.entryConfirmation !== undefined) updateData.entryConfirmation = data.entryConfirmation
  if (data.confirmationTimeout !== undefined)
    updateData.confirmationTimeout = data.confirmationTimeout
  if (data.pairs !== undefined) updateData.pairsJson = JSON.stringify(data.pairs)

  await db.tradeFinderConfig.update({
    where: { id: 1 },
    data: updateData,
  })

  return getTradeFinderConfig()
}
