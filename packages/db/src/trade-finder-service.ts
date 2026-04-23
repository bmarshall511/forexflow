/**
 * Trade Finder service — manages supply/demand zone-based trade setups.
 *
 * Handles creation, scoring, status transitions, and auto-trade tracking
 * for setups detected by the Trade Finder scanner. Setups follow the lifecycle:
 * active -> approaching -> placed -> filled -> invalidated/expired.
 *
 * @module trade-finder-service
 */
import { db } from "./client"
import { safeIso } from "./utils"
import type {
  TradeFinderSetupData,
  TradeFinderSetupStatus,
  TradeFinderScoreBreakdown,
  TradeFinderTimeframeSet,
  TradeFinderManagementAction,
  TradeFinderArrivalSpeed,
  TradeFinderTheoreticalOutcome,
  TradeFinderSession,
  TradeDirection,
  TradingMode,
  ZoneData,
  TrendData,
  CurveData,
} from "@fxflow/types"

// ─── Mappers ────────────────────────────────────────────────────────────────

/**
 * Map a Prisma row to the `TradeFinderSetupData` DTO, deserializing JSON fields
 * for scores, zone, trend, and curve data.
 *
 * @param row - Raw setup row from Prisma
 * @returns Serialized setup data for the API/UI
 */
function toSetupData(row: {
  id: string
  instrument: string
  direction: string
  timeframeSet: string
  status: string
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPips: number
  rewardPips: number
  rrRatio: string
  positionSize: number
  scoresJson: string
  scoreTotal: number
  zoneJson: string
  trendJson: string | null
  curveJson: string | null
  distanceToEntry: number
  resultSourceId: string | null
  autoPlaced: boolean
  placedAt: Date | null
  lastSkipReason: string | null
  confirmationPattern: string | null
  confirmationCandlesWaited: number
  breakevenMoved: boolean
  partialTaken: boolean
  managementLog: string | null
  arrivalSpeed: string | null
  theoreticalOutcomeJson: string | null
  detectionSession: string | null
  detectedAt: Date
  lastUpdatedAt: Date
}): TradeFinderSetupData {
  const scores = JSON.parse(row.scoresJson) as TradeFinderScoreBreakdown
  const zone = JSON.parse(row.zoneJson) as ZoneData
  const trendData = row.trendJson ? (JSON.parse(row.trendJson) as TrendData) : null
  const curveData = row.curveJson ? (JSON.parse(row.curveJson) as CurveData) : null
  const managementLog: TradeFinderManagementAction[] = row.managementLog
    ? (JSON.parse(row.managementLog) as TradeFinderManagementAction[])
    : []
  const theoreticalOutcome: TradeFinderTheoreticalOutcome | null = row.theoreticalOutcomeJson
    ? (JSON.parse(row.theoreticalOutcomeJson) as TradeFinderTheoreticalOutcome)
    : null

  return {
    id: row.id,
    instrument: row.instrument,
    direction: row.direction as TradeDirection,
    timeframeSet: row.timeframeSet as TradeFinderTimeframeSet,
    status: row.status as TradeFinderSetupStatus,
    zone,
    scores,
    entryPrice: row.entryPrice,
    stopLoss: row.stopLoss,
    takeProfit: row.takeProfit,
    riskPips: row.riskPips,
    rewardPips: row.rewardPips,
    rrRatio: row.rrRatio,
    positionSize: row.positionSize,
    trendData,
    curveData,
    distanceToEntryPips: row.distanceToEntry,
    detectedAt: safeIso(row.detectedAt),
    lastUpdatedAt: safeIso(row.lastUpdatedAt),
    resultSourceId: row.resultSourceId,
    autoPlaced: row.autoPlaced,
    placedAt: row.placedAt ? safeIso(row.placedAt) : null,
    lastSkipReason: row.lastSkipReason ?? null,
    confirmationPattern: row.confirmationPattern ?? null,
    confirmationCandlesWaited: row.confirmationCandlesWaited,
    breakevenMoved: row.breakevenMoved,
    partialTaken: row.partialTaken,
    managementLog,
    queuePosition: null, // Computed at runtime by the daemon scanner
    arrivalSpeed: (row.arrivalSpeed as TradeFinderArrivalSpeed) ?? null,
    theoreticalOutcome,
    detectionSession: (row.detectionSession as TradeFinderSession) ?? null,
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get all active/approaching setups, ordered by score descending */
export async function getActiveSetups(account?: TradingMode): Promise<TradeFinderSetupData[]> {
  const where: Record<string, unknown> = { status: { in: ["active", "approaching"] } }
  if (account) where.account = account
  const rows = await db.tradeFinderSetup.findMany({
    where,
    orderBy: { scoreTotal: "desc" },
  })
  return rows.map(toSetupData)
}

/** Get setups for a specific instrument */
export async function getSetupsByInstrument(
  instrument: string,
  account?: TradingMode,
): Promise<TradeFinderSetupData[]> {
  const where: Record<string, unknown> = {
    instrument,
    status: { in: ["active", "approaching"] },
  }
  if (account) where.account = account
  const rows = await db.tradeFinderSetup.findMany({
    where,
    orderBy: { scoreTotal: "desc" },
  })
  return rows.map(toSetupData)
}

/** Get setup history (placed, filled, invalidated, expired) */
export async function getSetupHistory(
  limit = 50,
  account?: TradingMode,
): Promise<TradeFinderSetupData[]> {
  const where: Record<string, unknown> = {
    status: { in: ["placed", "filled", "invalidated", "expired"] },
  }
  if (account) where.account = account
  const rows = await db.tradeFinderSetup.findMany({
    where,
    orderBy: { lastUpdatedAt: "desc" },
    take: limit,
  })
  return rows.map(toSetupData)
}

/** Get a single setup by ID */
export async function getSetup(id: string): Promise<TradeFinderSetupData | null> {
  const row = await db.tradeFinderSetup.findUnique({ where: { id } })
  return row ? toSetupData(row) : null
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Fields required to create a new trade finder setup. */
export interface CreateSetupInput {
  /** OANDA account this setup was detected for. */
  account: TradingMode
  instrument: string
  direction: TradeDirection
  timeframeSet: TradeFinderTimeframeSet
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPips: number
  rewardPips: number
  rrRatio: string
  positionSize: number
  scores: TradeFinderScoreBreakdown
  zone: ZoneData
  trendData: TrendData | null
  curveData: CurveData | null
  distanceToEntryPips: number
  arrivalSpeed?: TradeFinderArrivalSpeed
  detectionSession?: TradeFinderSession
}

/**
 * Create a new trade finder setup with computed scores and zone data.
 *
 * @param input - Setup creation parameters including instrument, levels, and scores
 * @returns The created setup data
 */
export async function createSetup(input: CreateSetupInput): Promise<TradeFinderSetupData> {
  const row = await db.tradeFinderSetup.create({
    data: {
      account: input.account,
      instrument: input.instrument,
      direction: input.direction,
      timeframeSet: input.timeframeSet,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      riskPips: input.riskPips,
      rewardPips: input.rewardPips,
      rrRatio: input.rrRatio,
      positionSize: input.positionSize,
      scoresJson: JSON.stringify(input.scores),
      scoreTotal: input.scores.total,
      zoneJson: JSON.stringify(input.zone),
      trendJson: input.trendData ? JSON.stringify(input.trendData) : null,
      curveJson: input.curveData ? JSON.stringify(input.curveData) : null,
      distanceToEntry: input.distanceToEntryPips,
      arrivalSpeed: input.arrivalSpeed ?? null,
      detectionSession: input.detectionSession ?? null,
    },
  })
  return toSetupData(row)
}

/**
 * Transition a setup to a new status, optionally updating related fields.
 * Automatically sets `placedAt` when status is "placed" and `expiredAt` when
 * status is "expired" or "invalidated".
 *
 * @param id - Setup ID
 * @param status - New status to transition to
 * @param extra - Optional fields to update alongside the status change
 */
export async function updateSetupStatus(
  id: string,
  status: TradeFinderSetupStatus,
  extra?: { resultSourceId?: string; distanceToEntry?: number; autoPlaced?: boolean },
): Promise<void> {
  const data: Record<string, unknown> = {
    status,
    lastUpdatedAt: new Date(),
  }
  if (extra?.resultSourceId !== undefined) data.resultSourceId = extra.resultSourceId
  if (extra?.distanceToEntry !== undefined) data.distanceToEntry = extra.distanceToEntry
  if (extra?.autoPlaced !== undefined) data.autoPlaced = extra.autoPlaced
  if (status === "placed") {
    data.placedAt = new Date()
    data.lastSkipReason = null
  }
  if (status === "expired" || status === "invalidated") data.expiredAt = new Date()

  await db.tradeFinderSetup.update({ where: { id }, data })
}

/**
 * Update a setup's scores, distance to entry, and optionally position size.
 * Called during periodic re-scoring as price moves.
 *
 * @param id - Setup ID
 * @param scores - Updated score breakdown
 * @param distanceToEntry - Current distance from price to entry in pips
 * @param positionSize - Optional updated position size
 */
export async function updateSetupScores(
  id: string,
  scores: TradeFinderScoreBreakdown,
  distanceToEntry: number,
  positionSize?: number,
): Promise<void> {
  const data: Record<string, unknown> = {
    scoresJson: JSON.stringify(scores),
    scoreTotal: scores.total,
    distanceToEntry,
    lastUpdatedAt: new Date(),
  }
  if (positionSize !== undefined) data.positionSize = positionSize

  await db.tradeFinderSetup.update({ where: { id }, data })
}

/** Update setup management state (breakeven, partial taken) */
export async function updateSetupManagement(
  id: string,
  data: { breakevenMoved?: boolean; partialTaken?: boolean; managementLog?: string },
): Promise<void> {
  await db.tradeFinderSetup.update({
    where: { id },
    data: { ...data, lastUpdatedAt: new Date() },
  })
}

/**
 * Append a structured management action entry to a Trade Finder setup's log.
 * Reads the current log, pushes the new entry, and writes back atomically.
 */
export async function appendTradeFinderManagementLog(
  id: string,
  entry: TradeFinderManagementAction,
): Promise<void> {
  const row = await db.tradeFinderSetup.findUnique({
    where: { id },
    select: { managementLog: true },
  })
  const log: TradeFinderManagementAction[] = row?.managementLog
    ? (JSON.parse(row.managementLog) as TradeFinderManagementAction[])
    : []
  log.push(entry)
  await db.tradeFinderSetup.update({
    where: { id },
    data: { managementLog: JSON.stringify(log), lastUpdatedAt: new Date() },
  })
}

/** Get all filled Trade Finder setups (for trade management) */
export async function getFilledSetups(): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: { status: "filled" },
    orderBy: { lastUpdatedAt: "desc" },
  })
  return rows.map(toSetupData)
}

/** Update setup entry price and confirmation pattern after entry confirmation */
export async function updateSetupConfirmation(
  id: string,
  entryPrice: number,
  confirmationPattern: string,
): Promise<void> {
  await db.tradeFinderSetup.update({
    where: { id },
    data: { entryPrice, confirmationPattern, lastUpdatedAt: new Date() },
  })
}

/** Increment the confirmation wait counter for a setup */
export async function updateSetupConfirmationWait(
  id: string,
  candlesWaited: number,
): Promise<void> {
  await db.tradeFinderSetup.update({
    where: { id },
    data: { confirmationCandlesWaited: candlesWaited, lastUpdatedAt: new Date() },
  })
}

/** Update the last skip reason for a setup (null to clear) */
export async function updateSetupSkipReason(id: string, reason: string | null): Promise<void> {
  await db.tradeFinderSetup.update({
    where: { id },
    data: { lastSkipReason: reason, lastUpdatedAt: new Date() },
  })
}

/** Remove old history setups beyond retention limit.
 *  "filled" and "placed" setups are NEVER pruned — they link to actual trades
 *  and are needed for setup analysis in the trade detail drawer. */
export async function pruneSetupHistory(keepCount = 200): Promise<number> {
  const prunableStatuses = ["invalidated", "expired"]
  const total = await db.tradeFinderSetup.count({
    where: { status: { in: prunableStatuses } },
  })

  if (total <= keepCount) return 0

  const toDelete = await db.tradeFinderSetup.findMany({
    where: { status: { in: prunableStatuses } },
    orderBy: { lastUpdatedAt: "asc" },
    take: total - keepCount,
    select: { id: true },
  })

  const result = await db.tradeFinderSetup.deleteMany({
    where: { id: { in: toDelete.map((r) => r.id) } },
  })

  return result.count
}

/** Check if a setup already exists for this instrument+direction+timeframeSet.
 *  Includes "placed" and "filled" to prevent re-detecting the same zone after order placement. */
export async function findExistingSetup(
  instrument: string,
  direction: TradeDirection,
  timeframeSet: TradeFinderTimeframeSet,
): Promise<TradeFinderSetupData | null> {
  const row = await db.tradeFinderSetup.findFirst({
    where: {
      instrument,
      direction,
      timeframeSet,
      status: { in: ["active", "approaching", "placed", "filled"] },
    },
  })
  return row ? toSetupData(row) : null
}

// ─── Auto-Trade Helpers ────────────────────────────────────────────────────

/**
 * Count auto-placed setups that are still at risk (pending OR filled but still open).
 * Both pending orders and open trades consume account risk.
 */
export async function countPendingAutoPlaced(): Promise<number> {
  return db.tradeFinderSetup.count({
    where: { status: { in: ["placed", "filled"] }, autoPlaced: true },
  })
}

/** Get all pending auto-placed setups (for cancel-all) */
export async function getPendingAutoPlacedSetups(): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: { status: "placed", autoPlaced: true },
    orderBy: { lastUpdatedAt: "desc" },
  })
  return rows.map(toSetupData)
}

/**
 * Get total risk pips across all auto-placed setups that are still at risk
 * (pending orders AND filled/open trades). Both consume account risk.
 */
export async function getAutoPlacedTotalRiskPips(): Promise<
  { instrument: string; riskPips: number; positionSize: number }[]
> {
  const rows = await db.tradeFinderSetup.findMany({
    where: { status: { in: ["placed", "filled"] }, autoPlaced: true },
    select: { instrument: true, riskPips: true, positionSize: true },
  })
  return rows
}

/** Clear all active/approaching setups */
export async function clearActiveSetups(): Promise<number> {
  const result = await db.tradeFinderSetup.deleteMany({
    where: { status: { in: ["active", "approaching"] } },
  })
  return result.count
}

/** Clear setup history. Keeps "filled" and "placed" setups that link to
 *  actual trades (needed for setup analysis in the trade detail drawer).
 *  Only removes invalidated and expired setups. */
export async function clearSetupHistory(): Promise<number> {
  const result = await db.tradeFinderSetup.deleteMany({
    where: { status: { in: ["invalidated", "expired"] } },
  })
  return result.count
}

/** Find a setup by its OANDA result source ID (order or trade ID) */
export async function findSetupByResultSourceId(
  sourceId: string,
): Promise<TradeFinderSetupData | null> {
  const row = await db.tradeFinderSetup.findFirst({
    where: { resultSourceId: sourceId },
  })
  return row ? toSetupData(row) : null
}

/** Find a "placed" setup by instrument and direction (for fill detection when order ID ≠ trade ID) */
export async function findPlacedSetupByInstrumentDirection(
  instrument: string,
  direction: string,
): Promise<TradeFinderSetupData | null> {
  const row = await db.tradeFinderSetup.findFirst({
    where: { instrument, direction, status: "placed" },
    orderBy: { placedAt: "desc" },
  })
  return row ? toSetupData(row) : null
}

/** Count auto-placed setups placed today (UTC day) for daily cap enforcement */
export async function countTodayAutoPlaced(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  return db.tradeFinderSetup.count({
    where: {
      autoPlaced: true,
      placedAt: { gte: startOfDay },
    },
  })
}

/** Get all "placed" auto-placed setups (for fill/cancel detection during validation) */
export async function getPlacedAutoSetups(): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: { status: "placed", autoPlaced: true, resultSourceId: { not: null } },
    orderBy: { lastUpdatedAt: "desc" },
  })
  return rows.map(toSetupData)
}

// ─── New: Theoretical Outcome & Arrival Speed ─────────────────────────────

/** Update the arrival speed classification for a setup */
export async function updateSetupArrivalSpeed(
  id: string,
  arrivalSpeed: TradeFinderArrivalSpeed,
): Promise<void> {
  await db.tradeFinderSetup.update({
    where: { id },
    data: { arrivalSpeed, lastUpdatedAt: new Date() },
  })
}

/** Store the theoretical outcome tracking data for a closed TF setup */
export async function updateSetupTheoreticalOutcome(
  id: string,
  outcome: TradeFinderTheoreticalOutcome,
): Promise<void> {
  await db.tradeFinderSetup.update({
    where: { id },
    data: { theoreticalOutcomeJson: JSON.stringify(outcome), lastUpdatedAt: new Date() },
  })
}

/** Get all filled setups that are missing theoretical outcome data (for background monitoring) */
export async function getFilledSetupsWithoutTheoreticalOutcome(): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: {
      status: "filled",
      theoreticalOutcomeJson: null,
    },
    orderBy: { lastUpdatedAt: "desc" },
  })
  return rows.map(toSetupData)
}

/** Get all setups with outcomes for adaptive learning (filled setups with known result) */
export async function getSetupsWithOutcomes(limit = 100): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: {
      status: "filled",
      autoPlaced: true,
    },
    orderBy: { lastUpdatedAt: "desc" },
    take: limit,
  })
  return rows.map(toSetupData)
}
