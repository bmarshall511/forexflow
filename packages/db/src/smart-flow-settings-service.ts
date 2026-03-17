import { db } from "./client"
import type { SmartFlowSettingsData, SmartFlowPreset } from "@fxflow/types"

export async function getSmartFlowSettings(): Promise<SmartFlowSettingsData> {
  const client = db
  const row = await client.smartFlowSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
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
  }
}

export async function updateSmartFlowSettings(
  fields: Partial<SmartFlowSettingsData>,
): Promise<SmartFlowSettingsData> {
  const client = db
  const data: Record<string, unknown> = {}
  const keys: (keyof SmartFlowSettingsData)[] = [
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
  ]
  for (const key of keys) {
    if (fields[key] !== undefined) data[key] = fields[key]
  }

  const row = await client.smartFlowSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  })
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
  }
}
