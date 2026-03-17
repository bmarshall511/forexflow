/**
 * SmartFlow trade service — manages SmartFlow active trade records and time estimates.
 *
 * Handles creation, status transitions, JSON log appending, AI cost tracking,
 * and time estimate storage for the SmartFlow trade management system.
 * Trades follow the lifecycle:
 * waiting_entry → pending → open → managing → closing → closed.
 *
 * @module smart-flow-trade-service
 */
import { db } from "./client"
import type {
  SmartFlowTradeData,
  SmartFlowTradeStatus,
  SmartFlowPhase,
  SmartFlowSafetyNet,
  SmartFlowManagementEntry,
  SmartFlowPartialCloseEntry,
  SmartFlowAiSuggestion,
  SmartFlowPreset,
} from "@fxflow/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely convert a Prisma date (may be invalid with libsql adapter) to ISO string. */
function safeIso(val: unknown): string {
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString()
  if (typeof val === "string" && val) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  if (typeof val === "number") return new Date(val).toISOString()
  return new Date().toISOString()
}

/** Safely parse a JSON string field, returning a fallback on failure. */
function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

/** Row shape from Prisma including the related config. */
interface SmartFlowTradeRow {
  id: string
  configId: string
  tradeId: string | null
  sourceTradeId: string | null
  status: string
  entryPrice: number | null
  currentPhase: string
  breakevenTriggered: boolean
  trailingActivated: boolean
  partialCloseLogJson: string
  managementLogJson: string
  recoveryLevel: number
  recoveryTradeIds: string
  estimatedHours: number | null
  estimatedLow: number | null
  estimatedHigh: number | null
  safetyNetTriggered: string | null
  financingAccumulated: number
  entrySpread: number | null
  avgSpread: number | null
  aiActionsToday: number
  aiLastActionAt: Date | null
  aiTotalCost: number
  aiTotalInputTokens: number
  aiTotalOutputTokens: number
  aiSuggestionsLogJson: string
  lastManualOverrideAt: Date | null
  createdAt: Date
  closedAt: Date | null
  updatedAt: Date
  config?: {
    instrument: string
    direction: string
    preset: string
    name: string
  }
}

/**
 * Map a Prisma row (with optional included config) to the `SmartFlowTradeData` DTO,
 * parsing all JSON fields with safe fallbacks.
 */
function toTradeData(row: SmartFlowTradeRow): SmartFlowTradeData {
  return {
    id: row.id,
    configId: row.configId,
    tradeId: row.tradeId,
    sourceTradeId: row.sourceTradeId,
    status: row.status as SmartFlowTradeStatus,
    entryPrice: row.entryPrice,
    currentPhase: row.currentPhase as SmartFlowPhase,
    breakevenTriggered: row.breakevenTriggered,
    trailingActivated: row.trailingActivated,
    partialCloseLog: safeJsonParse<SmartFlowPartialCloseEntry[]>(row.partialCloseLogJson, []),
    managementLog: safeJsonParse<SmartFlowManagementEntry[]>(row.managementLogJson, []),
    recoveryLevel: row.recoveryLevel,
    estimatedHours: row.estimatedHours,
    estimatedLow: row.estimatedLow,
    estimatedHigh: row.estimatedHigh,
    safetyNetTriggered: (row.safetyNetTriggered as SmartFlowSafetyNet | null) ?? null,
    financingAccumulated: row.financingAccumulated,
    entrySpread: row.entrySpread,
    aiActionsToday: row.aiActionsToday,
    aiTotalCost: row.aiTotalCost,
    aiSuggestions: safeJsonParse<SmartFlowAiSuggestion[]>(row.aiSuggestionsLogJson, []),
    createdAt: safeIso(row.createdAt),
    closedAt: row.closedAt ? safeIso(row.closedAt) : null,
    // Merged from config for display convenience
    instrument: row.config?.instrument,
    direction: row.config?.direction,
    preset: row.config?.preset as SmartFlowPreset | undefined,
    configName: row.config?.name,
  }
}

/** Standard include for config fields merged into trade data. */
const CONFIG_INCLUDE = {
  config: { select: { instrument: true, direction: true, preset: true, name: true } },
} as const

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Fields required to create a new SmartFlow trade. */
export interface CreateSmartFlowTradeInput {
  configId: string
  tradeId?: string
  sourceTradeId?: string
  status?: SmartFlowTradeStatus
  entryPrice?: number
  currentPhase?: SmartFlowPhase
  estimatedHours?: number
  estimatedLow?: number
  estimatedHigh?: number
  entrySpread?: number
}

/**
 * Create a new SmartFlow trade record linked to a config.
 *
 * @param input - Trade creation parameters
 * @returns The created trade data with config fields merged
 */
export async function createSmartFlowTrade(
  input: CreateSmartFlowTradeInput,
): Promise<SmartFlowTradeData> {
  const row = await db.smartFlowTrade.create({
    data: {
      configId: input.configId,
      tradeId: input.tradeId ?? null,
      sourceTradeId: input.sourceTradeId ?? null,
      status: input.status ?? "waiting_entry",
      entryPrice: input.entryPrice ?? null,
      currentPhase: input.currentPhase ?? "entry",
      estimatedHours: input.estimatedHours ?? null,
      estimatedLow: input.estimatedLow ?? null,
      estimatedHigh: input.estimatedHigh ?? null,
      entrySpread: input.entrySpread ?? null,
    },
    include: CONFIG_INCLUDE,
  })
  return toTradeData(row as unknown as SmartFlowTradeRow)
}

/** Get a SmartFlow trade by ID with config included. */
export async function getSmartFlowTrade(id: string): Promise<SmartFlowTradeData | null> {
  const row = await db.smartFlowTrade.findUnique({
    where: { id },
    include: CONFIG_INCLUDE,
  })
  return row ? toTradeData(row as unknown as SmartFlowTradeRow) : null
}

/** Find a SmartFlow trade by its linked Trade.id. */
export async function getSmartFlowTradeByTradeId(
  tradeId: string,
): Promise<SmartFlowTradeData | null> {
  const row = await db.smartFlowTrade.findFirst({
    where: { tradeId },
    include: CONFIG_INCLUDE,
  })
  return row ? toTradeData(row as unknown as SmartFlowTradeRow) : null
}

/** Find a SmartFlow trade by its OANDA source trade ID. */
export async function getSmartFlowTradeBySourceId(
  sourceTradeId: string,
): Promise<SmartFlowTradeData | null> {
  const row = await db.smartFlowTrade.findFirst({
    where: { sourceTradeId },
    include: CONFIG_INCLUDE,
  })
  return row ? toTradeData(row as unknown as SmartFlowTradeRow) : null
}

/** Get all non-closed SmartFlow trades with config, ordered by creation date descending. */
export async function getActiveSmartFlowTrades(): Promise<SmartFlowTradeData[]> {
  const rows = await db.smartFlowTrade.findMany({
    where: { status: { not: "closed" } },
    include: CONFIG_INCLUDE,
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => toTradeData(r as unknown as SmartFlowTradeRow))
}

/** Get SmartFlow trades filtered by status. */
export async function getSmartFlowTradesByStatus(
  status: SmartFlowTradeStatus,
): Promise<SmartFlowTradeData[]> {
  const rows = await db.smartFlowTrade.findMany({
    where: { status },
    include: CONFIG_INCLUDE,
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => toTradeData(r as unknown as SmartFlowTradeRow))
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Generic update for arbitrary SmartFlow trade fields. */
export async function updateSmartFlowTrade(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await db.smartFlowTrade.update({
    where: { id },
    data: { ...fields, updatedAt: new Date() },
  })
}

/**
 * Transition a SmartFlow trade to a new status, optionally updating extra fields.
 *
 * @param id - Trade ID
 * @param status - New status
 * @param extra - Optional additional fields to set alongside the status change
 */
export async function updateSmartFlowTradeStatus(
  id: string,
  status: SmartFlowTradeStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const data: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }
  if (extra) {
    Object.assign(data, extra)
  }
  await db.smartFlowTrade.update({ where: { id }, data })
}

/**
 * Append an entry to the management log JSON array.
 * Reads the current log, appends the entry, and writes back.
 */
export async function appendManagementLog(
  id: string,
  entry: SmartFlowManagementEntry,
): Promise<void> {
  const row = await db.smartFlowTrade.findUnique({
    where: { id },
    select: { managementLogJson: true },
  })
  if (!row) throw new Error(`SmartFlow trade not found: ${id}`)

  const log = safeJsonParse<SmartFlowManagementEntry[]>(row.managementLogJson, [])
  log.push(entry)

  await db.smartFlowTrade.update({
    where: { id },
    data: { managementLogJson: JSON.stringify(log), updatedAt: new Date() },
  })
}

/**
 * Append an entry to the partial close log JSON array.
 * Reads the current log, appends the entry, and writes back.
 */
export async function appendPartialCloseLog(
  id: string,
  entry: SmartFlowPartialCloseEntry,
): Promise<void> {
  const row = await db.smartFlowTrade.findUnique({
    where: { id },
    select: { partialCloseLogJson: true },
  })
  if (!row) throw new Error(`SmartFlow trade not found: ${id}`)

  const log = safeJsonParse<SmartFlowPartialCloseEntry[]>(row.partialCloseLogJson, [])
  log.push(entry)

  await db.smartFlowTrade.update({
    where: { id },
    data: { partialCloseLogJson: JSON.stringify(log), updatedAt: new Date() },
  })
}

/**
 * Append an AI suggestion to the suggestions log JSON array.
 * Also increments aiActionsToday and updates aiLastActionAt.
 */
export async function appendAiSuggestion(
  id: string,
  suggestion: SmartFlowAiSuggestion,
): Promise<void> {
  const row = await db.smartFlowTrade.findUnique({
    where: { id },
    select: { aiSuggestionsLogJson: true, aiActionsToday: true },
  })
  if (!row) throw new Error(`SmartFlow trade not found: ${id}`)

  const suggestions = safeJsonParse<SmartFlowAiSuggestion[]>(row.aiSuggestionsLogJson, [])
  suggestions.push(suggestion)

  await db.smartFlowTrade.update({
    where: { id },
    data: {
      aiSuggestionsLogJson: JSON.stringify(suggestions),
      aiActionsToday: row.aiActionsToday + 1,
      aiLastActionAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

/**
 * Increment AI cost running totals for a trade.
 *
 * @param id - Trade ID
 * @param cost - USD cost to add
 * @param inputTokens - Input tokens to add
 * @param outputTokens - Output tokens to add
 */
export async function incrementAiCost(
  id: string,
  cost: number,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const row = await db.smartFlowTrade.findUnique({
    where: { id },
    select: { aiTotalCost: true, aiTotalInputTokens: true, aiTotalOutputTokens: true },
  })
  if (!row) throw new Error(`SmartFlow trade not found: ${id}`)

  await db.smartFlowTrade.update({
    where: { id },
    data: {
      aiTotalCost: row.aiTotalCost + cost,
      aiTotalInputTokens: row.aiTotalInputTokens + inputTokens,
      aiTotalOutputTokens: row.aiTotalOutputTokens + outputTokens,
      updatedAt: new Date(),
    },
  })
}

/** Reset aiActionsToday to 0 for all active (non-closed) trades. Called daily. */
export async function resetDailyAiActions(): Promise<void> {
  await db.smartFlowTrade.updateMany({
    where: { status: { not: "closed" } },
    data: { aiActionsToday: 0 },
  })
}

/**
 * Close a SmartFlow trade — sets status to "closed" and closedAt to now.
 *
 * @param id - Trade ID
 * @param safetyNet - Optional safety net that triggered the close
 */
export async function closeSmartFlowTrade(
  id: string,
  safetyNet?: SmartFlowSafetyNet,
): Promise<void> {
  const data: Record<string, unknown> = {
    status: "closed",
    closedAt: new Date(),
    updatedAt: new Date(),
  }
  if (safetyNet) {
    data.safetyNetTriggered = safetyNet
  }
  await db.smartFlowTrade.update({ where: { id }, data })
}

/** Count all non-closed SmartFlow trades. */
export async function countOpenSmartFlowTrades(): Promise<number> {
  return db.smartFlowTrade.count({
    where: { status: { not: "closed" } },
  })
}

/** Options for paginated trade history query. */
export interface SmartFlowHistoryOptions {
  limit?: number
  offset?: number
  configId?: string
}

/** Get paginated closed SmartFlow trades, newest first. */
export async function getSmartFlowTradeHistory(
  options?: SmartFlowHistoryOptions,
): Promise<SmartFlowTradeData[]> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const where: Record<string, unknown> = { status: "closed" }
  if (options?.configId) {
    where.configId = options.configId
  }

  const rows = await db.smartFlowTrade.findMany({
    where,
    include: CONFIG_INCLUDE,
    orderBy: { closedAt: "desc" },
    take: limit,
    skip: offset,
  })
  return rows.map((r) => toTradeData(r as unknown as SmartFlowTradeRow))
}

// ─── Time Estimates ──────────────────────────────────────────────────────────

/** Fields required to store a time estimate data point. */
export interface CreateTimeEstimateInput {
  instrument: string
  preset: string
  direction: string
  targetPips: number
  actualHours: number
  outcome: string
}

/** Store a completed trade's time data for future estimation. */
export async function createTimeEstimate(input: CreateTimeEstimateInput): Promise<void> {
  await db.smartFlowTimeEstimate.create({
    data: {
      instrument: input.instrument,
      preset: input.preset,
      direction: input.direction,
      targetPips: input.targetPips,
      actualHours: input.actualHours,
      outcome: input.outcome,
      closedAt: new Date(),
    },
  })
}

/** Retrieve historical time estimates for prediction, limited and ordered by recency. */
export async function getTimeEstimates(
  instrument: string,
  preset: string,
  direction: string,
  limit = 20,
): Promise<
  {
    targetPips: number
    actualHours: number
    outcome: string
    closedAt: string
  }[]
> {
  const rows = await db.smartFlowTimeEstimate.findMany({
    where: { instrument, preset, direction },
    orderBy: { closedAt: "desc" },
    take: limit,
    select: { targetPips: true, actualHours: true, outcome: true, closedAt: true },
  })
  return rows.map((r) => ({
    targetPips: r.targetPips,
    actualHours: r.actualHours,
    outcome: r.outcome,
    closedAt: safeIso(r.closedAt),
  }))
}
