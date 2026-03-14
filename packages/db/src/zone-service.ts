/**
 * Supply/Demand zone service — persists and queries zone detection results.
 *
 * Handles soft-update upsert strategy (matched zones update, new zones insert,
 * missing zones invalidate), zone querying with score/status filters,
 * and cleanup of old invalidated zones.
 *
 * @module zone-service
 */
import { db } from "./client"
import type { ZoneData, ZoneStatus, PersistedZoneData } from "@fxflow/types"

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map a Prisma zone row to the `PersistedZoneData` DTO, deserializing
 * JSON fields for scores and risk/reward data.
 *
 * @param row - Raw zone row from Prisma
 * @returns Serialized zone data (ageInCandles and distanceFromPricePips are zeroed; computed by caller)
 */
function toPersistedZone(row: {
  id: string
  instrument: string
  timeframe: string
  type: string
  formation: string
  proximalLine: number
  distalLine: number
  width: number
  widthPips: number
  baseStartTime: number
  baseEndTime: number
  baseCandles: number
  baseStartIndex: number
  baseEndIndex: number
  scoreStrength: number
  scoreTime: number
  scoreFreshness: number
  scoreTotal: number
  scoresJson: string
  riskRewardJson: string
  status: string
  penetrationPct: number
  testCount: number
  firstDetectedAt: Date
  lastConfirmedAt: Date
  lastScoredAt: Date
}): PersistedZoneData {
  let scores
  try {
    scores = JSON.parse(row.scoresJson)
  } catch {
    scores = {
      strength: { value: row.scoreStrength, max: 2, label: "", explanation: "" },
      time: { value: row.scoreTime, max: 1, label: "", explanation: "" },
      freshness: { value: row.scoreFreshness, max: 2, label: "", explanation: "" },
      total: row.scoreTotal,
    }
  }

  let riskReward
  try {
    riskReward = JSON.parse(row.riskRewardJson)
  } catch {
    riskReward = {
      entryPrice: row.proximalLine,
      stopLossPrice: row.distalLine,
      takeProfitPrice: null,
      riskPips: row.widthPips,
      rewardPips: null,
      ratio: null,
    }
  }

  return {
    id: `${row.instrument}_${row.timeframe}_${row.type}_${row.baseStartTime}_${row.baseEndTime}`,
    dbId: row.id,
    type: row.type as ZoneData["type"],
    formation: row.formation as ZoneData["formation"],
    instrument: row.instrument,
    timeframe: row.timeframe,
    proximalLine: row.proximalLine,
    distalLine: row.distalLine,
    width: row.width,
    widthPips: row.widthPips,
    baseStartTime: row.baseStartTime,
    baseEndTime: row.baseEndTime,
    baseCandles: row.baseCandles,
    baseStartIndex: row.baseStartIndex,
    baseEndIndex: row.baseEndIndex,
    scores,
    riskReward,
    status: row.status as ZoneData["status"],
    penetrationPercent: row.penetrationPct,
    testCount: row.testCount,
    ageInCandles: 0, // Computed at query time by caller
    distanceFromPricePips: 0, // Computed at query time by caller
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    lastConfirmedAt: row.lastConfirmedAt.toISOString(),
    lastScoredAt: row.lastScoredAt.toISOString(),
  }
}

// ─── Upsert Zones (soft-update strategy) ────────────────────────────────────

/**
 * Soft-update zones for an instrument+timeframe:
 * - Matched zones: update scores, status, and timestamps
 * - New zones: insert
 * - Missing zones: mark as invalidated
 */
export async function upsertZones(
  instrument: string,
  timeframe: string,
  zones: ZoneData[],
): Promise<void> {
  const now = new Date()

  // Build a set of unique keys from incoming zones
  const incomingKeys = new Set(zones.map((z) => `${z.baseStartTime}_${z.baseEndTime}_${z.type}`))

  // Fetch existing zones for this instrument+timeframe
  const existing = await db.supplyDemandZone.findMany({
    where: { instrument, timeframe },
  })

  const existingByKey = new Map(
    existing.map((row) => [`${row.baseStartTime}_${row.baseEndTime}_${row.type}`, row]),
  )

  // Process in a transaction
  await db.$transaction(async (tx) => {
    for (const zone of zones) {
      const key = `${zone.baseStartTime}_${zone.baseEndTime}_${zone.type}`
      const existingRow = existingByKey.get(key)

      const data = {
        instrument,
        timeframe,
        type: zone.type,
        formation: zone.formation,
        proximalLine: zone.proximalLine,
        distalLine: zone.distalLine,
        width: zone.width,
        widthPips: zone.widthPips,
        baseStartTime: zone.baseStartTime,
        baseEndTime: zone.baseEndTime,
        baseCandles: zone.baseCandles,
        baseStartIndex: zone.baseStartIndex,
        baseEndIndex: zone.baseEndIndex,
        scoreStrength: zone.scores.strength.value,
        scoreTime: zone.scores.time.value,
        scoreFreshness: zone.scores.freshness.value,
        scoreTotal: zone.scores.total,
        scoresJson: JSON.stringify(zone.scores),
        riskRewardJson: JSON.stringify(zone.riskReward),
        status: zone.status,
        penetrationPct: zone.penetrationPercent,
        testCount: zone.testCount,
        lastConfirmedAt: now,
        lastScoredAt: now,
      }

      if (existingRow) {
        await tx.supplyDemandZone.update({
          where: { id: existingRow.id },
          data,
        })
      } else {
        await tx.supplyDemandZone.create({
          data: { ...data, firstDetectedAt: now },
        })
      }
    }

    // Mark zones not in incoming set as invalidated
    for (const [key, row] of existingByKey) {
      if (!incomingKeys.has(key) && row.status !== "invalidated") {
        await tx.supplyDemandZone.update({
          where: { id: row.id },
          data: { status: "invalidated", lastConfirmedAt: now },
        })
      }
    }
  })
}

// ─── Query Zones ────────────────────────────────────────────────────────────

/** Filtering options for zone queries. */
export interface GetZonesOptions {
  status?: ZoneStatus[]
  minScore?: number
  limit?: number
}

/** Get zones for an instrument+timeframe with optional filters. */
export async function getZones(
  instrument: string,
  timeframe: string,
  options?: GetZonesOptions,
): Promise<PersistedZoneData[]> {
  const where: Record<string, unknown> = { instrument, timeframe }

  if (options?.status && options.status.length > 0) {
    where.status = { in: options.status }
  }

  if (options?.minScore !== undefined) {
    where.scoreTotal = { gte: options.minScore }
  }

  const rows = await db.supplyDemandZone.findMany({
    where,
    orderBy: [{ scoreTotal: "desc" }, { baseEndTime: "desc" }],
    take: options?.limit,
  })

  return rows.map(toPersistedZone)
}

/** Get all zones for an instrument across all timeframes. */
export async function getZonesByInstrument(instrument: string): Promise<PersistedZoneData[]> {
  const rows = await db.supplyDemandZone.findMany({
    where: { instrument },
    orderBy: [{ scoreTotal: "desc" }],
  })
  return rows.map(toPersistedZone)
}

/** Mark a single zone as invalidated. */
export async function invalidateZone(id: string): Promise<void> {
  await db.supplyDemandZone.update({
    where: { id },
    data: { status: "invalidated", lastConfirmedAt: new Date() },
  })
}

/** Delete invalidated zones older than N days. Returns count deleted. */
export async function cleanupOldZones(olderThanDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const result = await db.supplyDemandZone.deleteMany({
    where: {
      status: "invalidated",
      lastConfirmedAt: { lt: cutoff },
    },
  })
  return result.count
}
