import { db } from "./client"
import type {
  SmartFlowSettingsData,
  SmartFlowPreset,
  SmartFlowOperatingMode,
  SmartFlowScanMode,
  SmartFlowScannerEntryMode,
  SmartFlowSessionRestriction,
} from "@fxflow/types"
import { SMART_FLOW_DEFAULT_SCAN_MODES } from "@fxflow/types"
import { safeJsonParse } from "./utils"

function toSettingsData(row: {
  enabled: boolean
  maxConcurrentTrades: number
  maxMarginPercent: number
  defaultPreset: string
  correlationWarningEnabled: boolean
  maxCorrelatedPairs: number
  aiBudgetDailyUsd: number
  aiBudgetMonthlyUsd: number
  aiDefaultModel: string
  defaultMaxDrawdownPercent: number
  defaultMaxHoldHours: number
  defaultMaxFinancingUsd: number
  spreadProtectionEnabled: boolean
  spreadProtectionMultiple: number
  shadowMode: boolean
  scannerEnabled: boolean
  scanIntervalMinutes: number
  operatingMode: string
  autoTradeMinScore: number
  scanModesJson: string
  pairWhitelistJson: string
  maxDailyScans: number
  maxDailyAutoTrades: number
  preferredPreset: string
  scannerEntryMode: string
  sessionRestriction: string
  newsBufferMinutes: number
  circuitBreakerConsecLosses: number
  circuitBreakerConsecPause: number
  circuitBreakerDailyLosses: number
  circuitBreakerDailyDD: number
}): SmartFlowSettingsData {
  const parsedModes = safeJsonParse<Record<string, boolean>>(
    row.scanModesJson,
    {},
    "smartFlowSettings.scanModesJson",
  )
  // Merge with defaults so new modes are always present
  const scanModes = { ...SMART_FLOW_DEFAULT_SCAN_MODES, ...parsedModes } as Record<
    SmartFlowScanMode,
    boolean
  >

  return {
    enabled: row.enabled,
    maxConcurrentTrades: row.maxConcurrentTrades,
    maxMarginPercent: row.maxMarginPercent,
    defaultPreset: row.defaultPreset as SmartFlowPreset,
    correlationWarningEnabled: row.correlationWarningEnabled,
    maxCorrelatedPairs: row.maxCorrelatedPairs,
    aiBudgetDailyUsd: row.aiBudgetDailyUsd,
    aiBudgetMonthlyUsd: row.aiBudgetMonthlyUsd,
    aiDefaultModel: row.aiDefaultModel,
    defaultMaxDrawdownPercent: row.defaultMaxDrawdownPercent,
    defaultMaxHoldHours: row.defaultMaxHoldHours,
    defaultMaxFinancingUsd: row.defaultMaxFinancingUsd,
    spreadProtectionEnabled: row.spreadProtectionEnabled,
    spreadProtectionMultiple: row.spreadProtectionMultiple,
    shadowMode: row.shadowMode,
    scannerEnabled: row.scannerEnabled,
    scanIntervalMinutes: row.scanIntervalMinutes,
    operatingMode: row.operatingMode as SmartFlowOperatingMode,
    autoTradeMinScore: row.autoTradeMinScore,
    scanModes,
    pairWhitelist: safeJsonParse<string[]>(
      row.pairWhitelistJson,
      [],
      "smartFlowSettings.pairWhitelistJson",
    ),
    maxDailyScans: row.maxDailyScans,
    maxDailyAutoTrades: row.maxDailyAutoTrades,
    preferredPreset: row.preferredPreset,
    scannerEntryMode: row.scannerEntryMode as SmartFlowScannerEntryMode,
    sessionRestriction: row.sessionRestriction as SmartFlowSessionRestriction,
    newsBufferMinutes: row.newsBufferMinutes,
    circuitBreakerConsecLosses: row.circuitBreakerConsecLosses,
    circuitBreakerConsecPause: row.circuitBreakerConsecPause,
    circuitBreakerDailyLosses: row.circuitBreakerDailyLosses,
    circuitBreakerDailyDD: row.circuitBreakerDailyDD,
  }
}

export async function getSmartFlowSettings(): Promise<SmartFlowSettingsData> {
  const client = db
  const row = await client.smartFlowSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
  return toSettingsData(row)
}

export async function updateSmartFlowSettings(
  fields: Partial<SmartFlowSettingsData>,
): Promise<SmartFlowSettingsData> {
  const client = db
  const data: Record<string, unknown> = {}

  // Simple scalar fields — direct mapping
  const scalarKeys: (keyof SmartFlowSettingsData)[] = [
    "enabled",
    "maxConcurrentTrades",
    "maxMarginPercent",
    "defaultPreset",
    "correlationWarningEnabled",
    "maxCorrelatedPairs",
    "aiBudgetDailyUsd",
    "aiBudgetMonthlyUsd",
    "aiDefaultModel",
    "defaultMaxDrawdownPercent",
    "defaultMaxHoldHours",
    "defaultMaxFinancingUsd",
    "spreadProtectionEnabled",
    "spreadProtectionMultiple",
    "shadowMode",
    "scannerEnabled",
    "scanIntervalMinutes",
    "operatingMode",
    "autoTradeMinScore",
    "maxDailyScans",
    "maxDailyAutoTrades",
    "preferredPreset",
    "scannerEntryMode",
    "sessionRestriction",
    "newsBufferMinutes",
    "circuitBreakerConsecLosses",
    "circuitBreakerConsecPause",
    "circuitBreakerDailyLosses",
    "circuitBreakerDailyDD",
  ]
  for (const key of scalarKeys) {
    if (fields[key] !== undefined) data[key] = fields[key]
  }

  // JSON fields need serialization
  if (fields.scanModes !== undefined) {
    data.scanModesJson = JSON.stringify(fields.scanModes)
  }
  if (fields.pairWhitelist !== undefined) {
    data.pairWhitelistJson = JSON.stringify(fields.pairWhitelist)
  }

  const row = await client.smartFlowSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  })
  return toSettingsData(row)
}
