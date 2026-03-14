/**
 * AI Trader config service — manages the 3-tier AI trading pipeline configuration.
 *
 * Handles operating mode, scan intervals, confidence thresholds, pair whitelist,
 * strategy profiles, analysis techniques, management config, budget caps,
 * model selection, and encrypted external API keys (FRED, Alpha Vantage).
 * Uses a singleton row (id=1) for app-wide AI trader config.
 *
 * @module ai-trader-config-service
 */
import { db } from "./client"
import { encrypt, decrypt } from "./encryption"
import { safeJsonParse } from "./utils"
import type {
  AiTraderConfigData,
  AiTraderManagementConfig,
  AiTraderProfile,
  AiTraderTechnique,
} from "@fxflow/types"
import {
  AI_TRADER_DEFAULT_MANAGEMENT,
  AI_TRADER_DEFAULT_TECHNIQUES,
  AI_TRADER_DEFAULT_PROFILES,
} from "@fxflow/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maps API key type names to their corresponding database column names. */
const API_KEY_FIELD_MAP = {
  fred: "fredApiKey",
  alphaVantage: "alphaVantageApiKey",
} as const satisfies Record<string, string>

/** Supported external API key types for the AI trader. */
type ApiKeyType = keyof typeof API_KEY_FIELD_MAP

/** Get the singleton AI trader config row, creating it with defaults if it does not exist. */
async function getOrCreateConfig() {
  const existing = await db.aiTraderConfig.findUnique({ where: { id: 1 } })
  if (existing) return existing

  return db.aiTraderConfig.create({ data: { id: 1 } })
}

/**
 * Map a Prisma config row to the `AiTraderConfigData` DTO, deserializing JSON fields
 * and merging with defaults for profiles, techniques, and management config.
 *
 * @param config - Raw config row from Prisma
 * @returns Fully populated config data with API key presence flags
 */
function toConfigData(config: Awaited<ReturnType<typeof getOrCreateConfig>>): AiTraderConfigData {
  return {
    enabled: config.enabled,
    operatingMode: config.operatingMode as AiTraderConfigData["operatingMode"],
    scanIntervalMinutes: config.scanIntervalMinutes,
    confidenceThreshold: config.confidenceThreshold,
    minimumConfidence: config.minimumConfidence,
    maxConcurrentTrades: config.maxConcurrentTrades,
    pairWhitelist: safeJsonParse<string[]>(config.pairWhitelist, [], "pairWhitelist"),
    enabledProfiles: {
      ...AI_TRADER_DEFAULT_PROFILES,
      ...safeJsonParse<Record<AiTraderProfile, boolean>>(
        config.enabledProfiles,
        AI_TRADER_DEFAULT_PROFILES,
        "enabledProfiles",
      ),
    },
    enabledTechniques: {
      ...AI_TRADER_DEFAULT_TECHNIQUES,
      ...safeJsonParse<Record<AiTraderTechnique, boolean>>(
        config.enabledTechniques,
        AI_TRADER_DEFAULT_TECHNIQUES,
        "enabledTechniques",
      ),
    },
    managementConfig: {
      ...AI_TRADER_DEFAULT_MANAGEMENT,
      ...safeJsonParse<AiTraderManagementConfig>(
        config.managementConfig,
        AI_TRADER_DEFAULT_MANAGEMENT,
        "managementConfig",
      ),
    },
    reEvalIntervalMinutes: config.reEvalIntervalMinutes,
    dailyBudgetUsd: config.dailyBudgetUsd,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    scanModel: config.scanModel,
    decisionModel: config.decisionModel,
    fredApiKey: !!config.fredApiKey,
    alphaVantageApiKey: !!config.alphaVantageApiKey,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the current AI Trader configuration.
 *
 * @returns Full AI trader config data with defaults applied
 */
export async function getAiTraderConfig(): Promise<AiTraderConfigData> {
  const config = await getOrCreateConfig()
  return toConfigData(config)
}

/**
 * Partially update the AI Trader configuration. Only provided fields are updated.
 * JSON fields (pairWhitelist, profiles, techniques, management) are serialized.
 *
 * @param data - Fields to update
 * @returns The full updated config data
 */
export async function updateAiTraderConfig(
  data: Partial<{
    enabled: boolean
    operatingMode: AiTraderConfigData["operatingMode"]
    scanIntervalMinutes: number
    confidenceThreshold: number
    minimumConfidence: number
    maxConcurrentTrades: number
    pairWhitelist: string[]
    enabledProfiles: Record<AiTraderProfile, boolean>
    enabledTechniques: Record<AiTraderTechnique, boolean>
    managementConfig: AiTraderManagementConfig
    reEvalIntervalMinutes: number
    dailyBudgetUsd: number
    monthlyBudgetUsd: number
    scanModel: string
    decisionModel: string
  }>,
): Promise<AiTraderConfigData> {
  await getOrCreateConfig()

  const updateData: Record<string, unknown> = {}

  if (data.enabled !== undefined) updateData.enabled = data.enabled
  if (data.operatingMode !== undefined) updateData.operatingMode = data.operatingMode
  if (data.scanIntervalMinutes !== undefined)
    updateData.scanIntervalMinutes = data.scanIntervalMinutes
  if (data.confidenceThreshold !== undefined)
    updateData.confidenceThreshold = data.confidenceThreshold
  if (data.minimumConfidence !== undefined) updateData.minimumConfidence = data.minimumConfidence
  if (data.maxConcurrentTrades !== undefined)
    updateData.maxConcurrentTrades = data.maxConcurrentTrades
  if (data.pairWhitelist !== undefined)
    updateData.pairWhitelist = JSON.stringify(data.pairWhitelist)
  if (data.enabledProfiles !== undefined)
    updateData.enabledProfiles = JSON.stringify(data.enabledProfiles)
  if (data.enabledTechniques !== undefined)
    updateData.enabledTechniques = JSON.stringify(data.enabledTechniques)
  if (data.managementConfig !== undefined)
    updateData.managementConfig = JSON.stringify(data.managementConfig)
  if (data.reEvalIntervalMinutes !== undefined)
    updateData.reEvalIntervalMinutes = data.reEvalIntervalMinutes
  if (data.dailyBudgetUsd !== undefined) updateData.dailyBudgetUsd = data.dailyBudgetUsd
  if (data.monthlyBudgetUsd !== undefined) updateData.monthlyBudgetUsd = data.monthlyBudgetUsd
  if (data.scanModel !== undefined) updateData.scanModel = data.scanModel
  if (data.decisionModel !== undefined) updateData.decisionModel = data.decisionModel

  await db.aiTraderConfig.update({
    where: { id: 1 },
    data: updateData,
  })

  return getAiTraderConfig()
}

/**
 * Encrypt and store an external API key for the AI trader.
 *
 * @param keyType - The API key type ("fred" or "alphaVantage")
 * @param key - The plaintext API key to store
 */
export async function saveAiTraderApiKey(keyType: ApiKeyType, key: string): Promise<void> {
  await getOrCreateConfig()
  const field = API_KEY_FIELD_MAP[keyType]
  await db.aiTraderConfig.update({
    where: { id: 1 },
    data: { [field]: encrypt(key) },
  })
}

/**
 * Remove a stored external API key.
 *
 * @param keyType - The API key type to remove ("fred" or "alphaVantage")
 */
export async function deleteAiTraderApiKey(keyType: ApiKeyType): Promise<void> {
  await getOrCreateConfig()
  const field = API_KEY_FIELD_MAP[keyType]
  await db.aiTraderConfig.update({
    where: { id: 1 },
    data: { [field]: null },
  })
}

/**
 * Decrypt and return an external API key for internal daemon use.
 *
 * @param keyType - The API key type to decrypt ("fred" or "alphaVantage")
 * @returns The decrypted API key, or null if not stored or decryption fails
 */
export async function getDecryptedAiTraderKey(keyType: ApiKeyType): Promise<string | null> {
  const config = await getOrCreateConfig()
  const field = API_KEY_FIELD_MAP[keyType]
  const stored = config[field]
  if (!stored) return null
  try {
    return decrypt(stored)
  } catch (err) {
    console.error(
      `[ai-trader-config] Failed to decrypt ${keyType} API key:`,
      (err as Error).message,
    )
    return null
  }
}
