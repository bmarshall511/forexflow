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
  TradingMode,
} from "@fxflow/types"
import { getPipSize } from "@fxflow/shared"

import { safeIso, safeJsonParse } from "./utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  atrAtPlacement: number | null
  regimeAtPlacement: string | null
  aiActionsToday: number
  aiLastActionAt: Date | null
  aiTotalCost: number
  aiTotalInputTokens: number
  aiTotalOutputTokens: number
  aiSuggestionsLogJson: string
  lastManualOverrideAt: Date | null
  lastManagementAction: string | null
  createdAt: Date
  closedAt: Date | null
  updatedAt: Date
  config?: {
    instrument: string
    direction: string
    preset: string
    name: string
  }
  trade?: {
    entryPrice: number
    exitPrice: number | null
    realizedPL: number
    closeReason: string | null
    direction: string
    instrument: string
  } | null
}

/**
 * Map a Prisma row (with optional included config) to the `SmartFlowTradeData` DTO,
 * parsing all JSON fields with safe fallbacks.
 */
function toTradeData(row: SmartFlowTradeRow): SmartFlowTradeData {
  const trade = row.trade ?? null
  const instrument = trade?.instrument ?? row.config?.instrument
  // Derive pip P&L from entry/exit when we have the join. Uses shared pip-utils
  // so JPY pairs (0.01) vs non-JPY (0.0001) are handled correctly.
  let realizedPips: number | null = null
  if (trade && trade.exitPrice != null && instrument) {
    const pipSize = getPipSize(instrument)
    const delta = trade.exitPrice - trade.entryPrice
    const signed = trade.direction === "long" ? delta : -delta
    realizedPips = signed / pipSize
  }

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
    avgSpread: row.avgSpread,
    atrAtPlacement: row.atrAtPlacement,
    regimeAtPlacement: row.regimeAtPlacement,
    aiActionsToday: row.aiActionsToday,
    aiTotalCost: row.aiTotalCost,
    aiSuggestions: safeJsonParse<SmartFlowAiSuggestion[]>(row.aiSuggestionsLogJson, []),
    lastManagementAction: row.lastManagementAction,
    createdAt: safeIso(row.createdAt),
    closedAt: row.closedAt ? safeIso(row.closedAt) : null,
    // Merged from config for display convenience
    instrument,
    direction: trade?.direction ?? row.config?.direction,
    preset: row.config?.preset as SmartFlowPreset | undefined,
    configName: row.config?.name,
    // Joined from linked Trade
    realizedPL: trade ? trade.realizedPL : null,
    realizedPips,
    exitPrice: trade?.exitPrice ?? null,
    closeReason: trade?.closeReason ?? null,
  }
}

/** Standard include for config + linked Trade fields merged into trade data. */
const CONFIG_INCLUDE = {
  config: { select: { instrument: true, direction: true, preset: true, name: true } },
  trade: {
    select: {
      entryPrice: true,
      exitPrice: true,
      realizedPL: true,
      closeReason: true,
      direction: true,
      instrument: true,
    },
  },
} as const

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Fields required to create a new SmartFlow trade. */
export interface CreateSmartFlowTradeInput {
  /** OANDA account this trade was placed against. Derivable from config but stamped explicitly for query speed. */
  account?: TradingMode
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
  /**
   * ATR (in price units) captured at the moment the order was placed. Used
   * for per-regime / per-volatility performance analysis in post-mortems.
   */
  atrAtPlacement?: number
  /** Market regime captured at placement. `"trending" | "ranging" | ...`. */
  regimeAtPlacement?: string
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
      ...(input.account ? { account: input.account } : {}),
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
      atrAtPlacement: input.atrAtPlacement ?? null,
      regimeAtPlacement: input.regimeAtPlacement ?? null,
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
export async function getActiveSmartFlowTrades(
  account?: TradingMode,
): Promise<SmartFlowTradeData[]> {
  const where: Record<string, unknown> = { status: { not: "closed" } }
  if (account) where.account = account
  const rows = await db.smartFlowTrade.findMany({
    where,
    include: CONFIG_INCLUDE,
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => toTradeData(r as unknown as SmartFlowTradeRow))
}

/** Get SmartFlow trades filtered by status. */
export async function getSmartFlowTradesByStatus(
  status: SmartFlowTradeStatus,
  account?: TradingMode,
): Promise<SmartFlowTradeData[]> {
  const where: Record<string, unknown> = { status }
  if (account) where.account = account
  const rows = await db.smartFlowTrade.findMany({
    where,
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
 * Also stamps `lastManagementAction` with the action name so the dashboard
 * can show which rule last fired without having to parse the log JSON.
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
    data: {
      managementLogJson: JSON.stringify(log),
      lastManagementAction: entry.action,
      updatedAt: new Date(),
    },
  })
}

/**
 * Append an entry to the partial close log JSON array.
 * Reads the current log, appends the entry, and writes back.
 * Also stamps `lastManagementAction = "partial_close"` for dashboard display.
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
    data: {
      partialCloseLogJson: JSON.stringify(log),
      lastManagementAction: "partial_close",
      updatedAt: new Date(),
    },
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

/**
 * Sum AI cost across all SmartFlow trades with AI activity today.
 *
 * @returns Total AI spend in USD for today
 */
export async function getTodaySmartFlowAiCost(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const rows = await db.smartFlowTrade.findMany({
    where: { aiLastActionAt: { gte: startOfDay } },
    select: { aiTotalCost: true },
  })
  return rows.reduce((sum, r) => sum + r.aiTotalCost, 0)
}

/**
 * Sum AI cost across all SmartFlow trades with AI activity this month.
 *
 * @returns Total AI spend in USD for the current month
 */
export async function getMonthlySmartFlowAiCost(): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const rows = await db.smartFlowTrade.findMany({
    where: { aiLastActionAt: { gte: startOfMonth } },
    select: { aiTotalCost: true },
  })
  return rows.reduce((sum, r) => sum + r.aiTotalCost, 0)
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
    data.lastManagementAction = `safety_net:${safetyNet}`
  } else {
    data.lastManagementAction = "trade_closed"
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
  account?: TradingMode
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
  if (options?.account) where.account = options.account

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

/**
 * Estimate the expected hold time in hours for a new trade, based on historical
 * SmartFlowTimeEstimate rows for the same instrument/preset/direction.
 *
 * Uses winning outcomes only (wins + breakevens) and scales by the ratio of
 * target pips so a 40-pip target is priced off prior 40-pip targets, not 10-pip.
 * Returns null when there's no usable history.
 */
export async function estimateHoldTime(
  instrument: string,
  preset: string,
  direction: string,
  targetPips: number,
  limit = 40,
): Promise<{ estimatedHours: number; low: number; high: number } | null> {
  if (targetPips <= 0) return null
  const rows = await db.smartFlowTimeEstimate.findMany({
    where: {
      instrument,
      preset,
      direction,
      outcome: { not: "safety_net" },
      targetPips: { gt: 0 },
    },
    orderBy: { closedAt: "desc" },
    take: limit,
    select: { targetPips: true, actualHours: true },
  })
  if (rows.length === 0) return null

  // Per-sample hours-per-pip rate, scaled by our new target. Ignore outliers
  // past 4x the median rate so one stuck trade doesn't skew the estimate.
  const rates = rows.map((r) => r.actualHours / r.targetPips).sort((a, b) => a - b)
  const median = rates[Math.floor(rates.length / 2)] ?? 0
  if (median <= 0) return null
  const filtered = rates.filter((r) => r <= median * 4)
  const scaled = filtered.map((r) => r * targetPips).sort((a, b) => a - b)

  const estimatedHours = scaled[Math.floor(scaled.length / 2)] ?? median * targetPips
  const low = scaled[Math.floor(scaled.length * 0.2)] ?? estimatedHours * 0.5
  const high = scaled[Math.floor(scaled.length * 0.8)] ?? estimatedHours * 2
  return {
    estimatedHours: Math.round(estimatedHours * 100) / 100,
    low: Math.round(low * 100) / 100,
    high: Math.round(high * 100) / 100,
  }
}
