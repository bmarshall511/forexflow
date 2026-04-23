/**
 * SmartFlow config service — manages per-instrument trade management configurations.
 *
 * Each config defines entry mode, position sizing, SL/TP (ATR-relative or pips),
 * breakeven, trailing, partial close rules, safety nets, recovery, and AI assist settings.
 * Only one config can be active per instrument+direction at a time.
 *
 * @module smart-flow-config-service
 */
import { db } from "./client"
import { safeJsonParse } from "./utils"
import type {
  SmartFlowConfigData,
  SmartFlowPreset,
  SmartFlowEntryMode,
  SmartFlowSizeMode,
  SmartFlowAiMode,
  SmartFlowOffSessionBehavior,
  SmartFlowPartialCloseRule,
  SmartFlowEntryCondition,
  SmartFlowAiActionToggles,
  SmartFlowAiConfidenceThresholds,
  TradingMode,
} from "@fxflow/types"

// ─── Types ───────────────────────────────────────────────────────────────────

/** Input for creating a new SmartFlow config. Excludes auto-generated fields. */
export interface CreateSmartFlowConfigInput {
  /** OANDA account this config operates against. Stamped at create only. */
  account: TradingMode
  instrument: string
  name: string
  direction: "long" | "short"
  preset: SmartFlowPreset
  isActive: boolean
  entryMode: SmartFlowEntryMode
  entryPrice?: number | null
  entryConditions?: SmartFlowEntryCondition[] | null
  entryExpireHours?: number | null
  positionSizeMode: SmartFlowSizeMode
  positionSizeValue: number
  stopLossAtrMultiple?: number | null
  takeProfitAtrMultiple?: number | null
  stopLossPips?: number | null
  takeProfitPips?: number | null
  minRiskReward: number
  breakevenEnabled: boolean
  breakevenAtrMultiple: number
  breakevenBufferPips: number
  trailingEnabled: boolean
  trailingAtrMultiple: number
  trailingActivationAtr: number
  partialCloseRules?: SmartFlowPartialCloseRule[] | null
  maxDrawdownPercent?: number | null
  maxDrawdownPips?: number | null
  maxHoldHours?: number | null
  maxFinancingUsd?: number | null
  sessionAwareManagement: boolean
  offSessionBehavior: SmartFlowOffSessionBehavior
  weekendCloseEnabled: boolean
  newsProtectionEnabled: boolean
  newsProtectionMinutes: number
  recoveryEnabled: boolean
  recoveryMaxLevels: number
  recoveryAtrInterval: number
  recoverySizeMultiplier: number
  recoveryTpAtrMultiple: number
  aiMode: SmartFlowAiMode
  aiMonitorIntervalHours: number
  aiModel?: string | null
  aiActionToggles: SmartFlowAiActionToggles
  aiConfidenceThresholds: SmartFlowAiConfidenceThresholds
  aiMaxActionsPerDay: number
  aiCooldownAfterManualMins: number
  aiGracePeriodMins: number
}

/** Input for updating an existing SmartFlow config. All fields optional. */
export type UpdateSmartFlowConfigInput = Partial<CreateSmartFlowConfigInput>

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Default AI action toggles — all enabled by default. */
const DEFAULT_AI_ACTION_TOGGLES: SmartFlowAiActionToggles = {
  moveSL: true,
  moveTP: true,
  breakeven: true,
  partialClose: true,
  closeProfit: true,
  preemptiveSafetyClose: true,
  cancelEntry: true,
  adjustTrail: true,
}

/** Default AI confidence thresholds when JSON parsing fails. */
const DEFAULT_AI_CONFIDENCE_THRESHOLDS: SmartFlowAiConfidenceThresholds = {
  moveSL: 80,
  moveTP: 80,
  breakeven: 70,
  partialClose: 75,
  closeProfit: 85,
  preemptiveSafetyClose: 90,
  cancelEntry: 80,
  adjustTrail: 75,
}

/** Prisma row type for SmartFlowConfig. */
type SmartFlowConfigRow = NonNullable<Awaited<ReturnType<typeof db.smartFlowConfig.findUnique>>>

/**
 * Map a Prisma SmartFlowConfig row to the `SmartFlowConfigData` DTO,
 * deserializing JSON fields with safe fallbacks.
 */
function toConfigData(row: SmartFlowConfigRow): SmartFlowConfigData {
  return {
    id: row.id,
    instrument: row.instrument,
    name: row.name,
    direction: row.direction as "long" | "short",
    preset: row.preset as SmartFlowPreset,
    isActive: row.isActive,
    entryMode: row.entryMode as SmartFlowEntryMode,
    entryPrice: row.entryPrice,
    entryConditions: safeJsonParse<SmartFlowEntryCondition[] | null>(
      row.entryConditionsJson,
      null,
      "entryConditionsJson",
    ),
    entryExpireHours: row.entryExpireHours,
    positionSizeMode: row.positionSizeMode as SmartFlowSizeMode,
    positionSizeValue: row.positionSizeValue,
    stopLossAtrMultiple: row.stopLossAtrMultiple,
    takeProfitAtrMultiple: row.takeProfitAtrMultiple,
    stopLossPips: row.stopLossPips,
    takeProfitPips: row.takeProfitPips,
    minRiskReward: row.minRiskReward,
    breakevenEnabled: row.breakevenEnabled,
    breakevenAtrMultiple: row.breakevenAtrMultiple,
    breakevenBufferPips: row.breakevenBufferPips,
    trailingEnabled: row.trailingEnabled,
    trailingAtrMultiple: row.trailingAtrMultiple,
    trailingActivationAtr: row.trailingActivationAtr,
    partialCloseRules: safeJsonParse<SmartFlowPartialCloseRule[]>(
      row.partialCloseRulesJson,
      [],
      "partialCloseRulesJson",
    ),
    maxDrawdownPercent: row.maxDrawdownPercent,
    maxDrawdownPips: row.maxDrawdownPips,
    maxHoldHours: row.maxHoldHours,
    maxFinancingUsd: row.maxFinancingUsd,
    sessionAwareManagement: row.sessionAwareManagement,
    offSessionBehavior: row.offSessionBehavior as SmartFlowOffSessionBehavior,
    weekendCloseEnabled: row.weekendCloseEnabled,
    newsProtectionEnabled: row.newsProtectionEnabled,
    newsProtectionMinutes: row.newsProtectionMinutes,
    recoveryEnabled: row.recoveryEnabled,
    recoveryMaxLevels: row.recoveryMaxLevels,
    recoveryAtrInterval: row.recoveryAtrInterval,
    recoverySizeMultiplier: row.recoverySizeMultiplier,
    recoveryTpAtrMultiple: row.recoveryTpAtrMultiple,
    aiMode: row.aiMode as SmartFlowAiMode,
    aiMonitorIntervalHours: row.aiMonitorIntervalHours,
    aiModel: row.aiModel,
    aiActionToggles: {
      ...DEFAULT_AI_ACTION_TOGGLES,
      ...safeJsonParse<SmartFlowAiActionToggles>(
        row.aiActionTogglesJson,
        DEFAULT_AI_ACTION_TOGGLES,
        "aiActionTogglesJson",
      ),
    },
    aiConfidenceThresholds: {
      ...DEFAULT_AI_CONFIDENCE_THRESHOLDS,
      ...safeJsonParse<SmartFlowAiConfidenceThresholds>(
        row.aiConfidenceThresholdsJson,
        DEFAULT_AI_CONFIDENCE_THRESHOLDS,
        "aiConfidenceThresholdsJson",
      ),
    },
    aiMaxActionsPerDay: row.aiMaxActionsPerDay,
    aiCooldownAfterManualMins: row.aiCooldownAfterManualMins,
    aiGracePeriodMins: row.aiGracePeriodMins,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Build a Prisma `data` object from the input, serializing JSON fields.
 */
function buildPrismaData(input: Partial<CreateSmartFlowConfigInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  if (input.account !== undefined) data.account = input.account
  if (input.instrument !== undefined) data.instrument = input.instrument
  if (input.name !== undefined) data.name = input.name
  if (input.direction !== undefined) data.direction = input.direction
  if (input.preset !== undefined) data.preset = input.preset
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.entryMode !== undefined) data.entryMode = input.entryMode
  if (input.entryPrice !== undefined) data.entryPrice = input.entryPrice
  if (input.entryConditions !== undefined)
    data.entryConditionsJson = input.entryConditions ? JSON.stringify(input.entryConditions) : null
  if (input.entryExpireHours !== undefined) data.entryExpireHours = input.entryExpireHours
  if (input.positionSizeMode !== undefined) data.positionSizeMode = input.positionSizeMode
  if (input.positionSizeValue !== undefined) data.positionSizeValue = input.positionSizeValue
  if (input.stopLossAtrMultiple !== undefined) data.stopLossAtrMultiple = input.stopLossAtrMultiple
  if (input.takeProfitAtrMultiple !== undefined)
    data.takeProfitAtrMultiple = input.takeProfitAtrMultiple
  if (input.stopLossPips !== undefined) data.stopLossPips = input.stopLossPips
  if (input.takeProfitPips !== undefined) data.takeProfitPips = input.takeProfitPips
  if (input.minRiskReward !== undefined) data.minRiskReward = input.minRiskReward
  if (input.breakevenEnabled !== undefined) data.breakevenEnabled = input.breakevenEnabled
  if (input.breakevenAtrMultiple !== undefined)
    data.breakevenAtrMultiple = input.breakevenAtrMultiple
  if (input.breakevenBufferPips !== undefined) data.breakevenBufferPips = input.breakevenBufferPips
  if (input.trailingEnabled !== undefined) data.trailingEnabled = input.trailingEnabled
  if (input.trailingAtrMultiple !== undefined) data.trailingAtrMultiple = input.trailingAtrMultiple
  if (input.trailingActivationAtr !== undefined)
    data.trailingActivationAtr = input.trailingActivationAtr
  if (input.partialCloseRules !== undefined)
    data.partialCloseRulesJson = input.partialCloseRules
      ? JSON.stringify(input.partialCloseRules)
      : null
  if (input.maxDrawdownPercent !== undefined) data.maxDrawdownPercent = input.maxDrawdownPercent
  if (input.maxDrawdownPips !== undefined) data.maxDrawdownPips = input.maxDrawdownPips
  if (input.maxHoldHours !== undefined) data.maxHoldHours = input.maxHoldHours
  if (input.maxFinancingUsd !== undefined) data.maxFinancingUsd = input.maxFinancingUsd
  if (input.sessionAwareManagement !== undefined)
    data.sessionAwareManagement = input.sessionAwareManagement
  if (input.offSessionBehavior !== undefined) data.offSessionBehavior = input.offSessionBehavior
  if (input.weekendCloseEnabled !== undefined) data.weekendCloseEnabled = input.weekendCloseEnabled
  if (input.newsProtectionEnabled !== undefined)
    data.newsProtectionEnabled = input.newsProtectionEnabled
  if (input.newsProtectionMinutes !== undefined)
    data.newsProtectionMinutes = input.newsProtectionMinutes
  if (input.recoveryEnabled !== undefined) data.recoveryEnabled = input.recoveryEnabled
  if (input.recoveryMaxLevels !== undefined) data.recoveryMaxLevels = input.recoveryMaxLevels
  if (input.recoveryAtrInterval !== undefined) data.recoveryAtrInterval = input.recoveryAtrInterval
  if (input.recoverySizeMultiplier !== undefined)
    data.recoverySizeMultiplier = input.recoverySizeMultiplier
  if (input.recoveryTpAtrMultiple !== undefined)
    data.recoveryTpAtrMultiple = input.recoveryTpAtrMultiple
  if (input.aiMode !== undefined) data.aiMode = input.aiMode
  if (input.aiMonitorIntervalHours !== undefined)
    data.aiMonitorIntervalHours = input.aiMonitorIntervalHours
  if (input.aiModel !== undefined) data.aiModel = input.aiModel
  if (input.aiActionToggles !== undefined)
    data.aiActionTogglesJson = JSON.stringify(input.aiActionToggles)
  if (input.aiConfidenceThresholds !== undefined)
    data.aiConfidenceThresholdsJson = JSON.stringify(input.aiConfidenceThresholds)
  if (input.aiMaxActionsPerDay !== undefined) data.aiMaxActionsPerDay = input.aiMaxActionsPerDay
  if (input.aiCooldownAfterManualMins !== undefined)
    data.aiCooldownAfterManualMins = input.aiCooldownAfterManualMins
  if (input.aiGracePeriodMins !== undefined) data.aiGracePeriodMins = input.aiGracePeriodMins

  return data
}

/**
 * Deactivate all other active configs for the same instrument+direction.
 * Used when a config is activated to enforce the one-active-per-slot constraint.
 */
async function deactivateOthers(
  instrument: string,
  direction: string,
  excludeId: string,
): Promise<void> {
  await db.smartFlowConfig.updateMany({
    where: {
      instrument,
      direction,
      isActive: true,
      id: { not: excludeId },
    },
    data: { isActive: false },
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List all SmartFlow configs, ordered by instrument then creation date.
 * Pass `account` to restrict to a single OANDA account (practice vs. live).
 */
export async function getSmartFlowConfigs(account?: TradingMode): Promise<SmartFlowConfigData[]> {
  const rows = await db.smartFlowConfig.findMany({
    where: account ? { account } : undefined,
    orderBy: [{ instrument: "asc" }, { createdAt: "desc" }],
  })
  return rows.map(toConfigData)
}

/**
 * List SmartFlow configs for a specific instrument.
 */
export async function getSmartFlowConfigsByInstrument(
  instrument: string,
  account?: TradingMode,
): Promise<SmartFlowConfigData[]> {
  const where: Record<string, unknown> = { instrument }
  if (account) where.account = account
  const rows = await db.smartFlowConfig.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })
  return rows.map(toConfigData)
}

/**
 * Get the active SmartFlow config for a given instrument and direction.
 * Returns null if no active config exists for that slot.
 */
export async function getActiveSmartFlowConfig(
  instrument: string,
  direction: "long" | "short",
  account?: TradingMode,
): Promise<SmartFlowConfigData | null> {
  const where: Record<string, unknown> = { instrument, direction, isActive: true }
  if (account) where.account = account
  const row = await db.smartFlowConfig.findFirst({ where })
  return row ? toConfigData(row) : null
}

/**
 * Get a single SmartFlow config by ID.
 * Returns null if not found.
 */
export async function getSmartFlowConfig(id: string): Promise<SmartFlowConfigData | null> {
  const row = await db.smartFlowConfig.findUnique({ where: { id } })
  return row ? toConfigData(row) : null
}

/**
 * Create a new SmartFlow config. If `isActive` is true, deactivates any other
 * active config on the same instrument+direction.
 */
export async function createSmartFlowConfig(
  input: CreateSmartFlowConfigInput,
): Promise<SmartFlowConfigData> {
  const data = buildPrismaData(input)

  const row = await db.smartFlowConfig.create({
    data: data as Parameters<typeof db.smartFlowConfig.create>[0]["data"],
  })

  if (input.isActive) {
    await deactivateOthers(input.instrument, input.direction, row.id)
  }

  return toConfigData(row)
}

/**
 * Update an existing SmartFlow config. If `isActive` is being set to true,
 * deactivates other configs on the same instrument+direction.
 */
export async function updateSmartFlowConfig(
  id: string,
  fields: UpdateSmartFlowConfigInput,
): Promise<SmartFlowConfigData> {
  const data = buildPrismaData(fields)

  const row = await db.smartFlowConfig.update({
    where: { id },
    data,
  })

  if (fields.isActive === true) {
    await deactivateOthers(row.instrument, row.direction, row.id)
  }

  return toConfigData(row)
}

/**
 * Delete a SmartFlow config by ID.
 */
export async function deleteSmartFlowConfig(id: string): Promise<void> {
  await db.smartFlowConfig.delete({ where: { id } })
}

/**
 * Activate a SmartFlow config. Deactivates any other active config
 * on the same instrument+direction.
 */
export async function activateSmartFlowConfig(id: string): Promise<SmartFlowConfigData> {
  const row = await db.smartFlowConfig.update({
    where: { id },
    data: { isActive: true },
  })

  await deactivateOthers(row.instrument, row.direction, row.id)

  return toConfigData(row)
}

/**
 * Deactivate a SmartFlow config.
 */
export async function deactivateSmartFlowConfig(id: string): Promise<SmartFlowConfigData> {
  const row = await db.smartFlowConfig.update({
    where: { id },
    data: { isActive: false },
  })

  return toConfigData(row)
}

/**
 * Count the total number of active SmartFlow configs.
 */
export async function countActiveConfigs(): Promise<number> {
  return db.smartFlowConfig.count({ where: { isActive: true } })
}
