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
import type {
  TradeFinderSetupData,
  TradeFinderSetupStatus,
  TradeFinderScoreBreakdown,
  TradeFinderTimeframeSet,
  TradeDirection,
  ZoneData,
  TrendData,
  CurveData,
} from "@fxflow/types"

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
  breakevenMoved: boolean
  partialTaken: boolean
  managementLog: string | null
  detectedAt: Date
  lastUpdatedAt: Date
}): TradeFinderSetupData {
  const scores = JSON.parse(row.scoresJson) as TradeFinderScoreBreakdown
  const zone = JSON.parse(row.zoneJson) as ZoneData
  const trendData = row.trendJson ? (JSON.parse(row.trendJson) as TrendData) : null
  const curveData = row.curveJson ? (JSON.parse(row.curveJson) as CurveData) : null

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
    breakevenMoved: row.breakevenMoved,
    partialTaken: row.partialTaken,
    queuePosition: null, // Computed at runtime by the daemon scanner
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get all active/approaching setups, ordered by score descending */
export async function getActiveSetups(): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: { status: { in: ["active", "approaching"] } },
    orderBy: { scoreTotal: "desc" },
  })
  return rows.map(toSetupData)
}

/** Get setups for a specific instrument */
export async function getSetupsByInstrument(instrument: string): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: { instrument, status: { in: ["active", "approaching"] } },
    orderBy: { scoreTotal: "desc" },
  })
  return rows.map(toSetupData)
}

/** Get setup history (placed, filled, invalidated, expired) */
export async function getSetupHistory(limit = 50): Promise<TradeFinderSetupData[]> {
  const rows = await db.tradeFinderSetup.findMany({
    where: { status: { in: ["placed", "filled", "invalidated", "expired"] } },
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
