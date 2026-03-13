import { db } from "./client"
import type { TrendData } from "@fxflow/types"

/** Upsert a trend detection result — one row per instrument+timeframe (latest wins). */
export async function upsertTrend(data: TrendData): Promise<void> {
  // Find existing row for this instrument+timeframe
  const existing = await db.detectedTrend.findFirst({
    where: { instrument: data.instrument, timeframe: data.timeframe },
    orderBy: { computedAt: "desc" },
  })

  const payload = {
    instrument: data.instrument,
    timeframe: data.timeframe,
    direction: data.direction,
    status: data.status,
    swingPointsJson: JSON.stringify(data.swingPoints),
    segmentsJson: JSON.stringify(data.segments),
    controllingSwing: data.controllingSwing ? JSON.stringify(data.controllingSwing) : null,
    currentPrice: data.currentPrice,
    candlesAnalyzed: data.candlesAnalyzed,
    computedAt: new Date(data.computedAt),
  }

  if (existing) {
    await db.detectedTrend.update({
      where: { id: existing.id },
      data: payload,
    })
  } else {
    await db.detectedTrend.create({ data: payload })
  }
}

/** Get the most recent trend for an instrument+timeframe. */
export async function getTrend(instrument: string, timeframe: string): Promise<TrendData | null> {
  const row = await db.detectedTrend.findFirst({
    where: { instrument, timeframe },
    orderBy: { computedAt: "desc" },
  })

  if (!row) return null

  return {
    instrument: row.instrument,
    timeframe: row.timeframe,
    direction: row.direction as TrendData["direction"],
    status: row.status as TrendData["status"],
    swingPoints: safeJsonParse(row.swingPointsJson, []),
    segments: safeJsonParse(row.segmentsJson, []),
    controllingSwing: row.controllingSwing ? safeJsonParse(row.controllingSwing, null) : null,
    controllingSwingDistancePips: null, // Not persisted — recomputed at query time
    currentPrice: row.currentPrice,
    candlesAnalyzed: row.candlesAnalyzed,
    computedAt: row.computedAt.toISOString(),
  }
}

/** Get trend history for an instrument+timeframe. */
export async function getTrendHistory(
  instrument: string,
  timeframe: string,
  limit = 50,
): Promise<TrendData[]> {
  const rows = await db.detectedTrend.findMany({
    where: { instrument, timeframe },
    orderBy: { computedAt: "desc" },
    take: limit,
  })

  return rows.map((row) => ({
    instrument: row.instrument,
    timeframe: row.timeframe,
    direction: row.direction as TrendData["direction"],
    status: row.status as TrendData["status"],
    swingPoints: safeJsonParse(row.swingPointsJson, []),
    segments: safeJsonParse(row.segmentsJson, []),
    controllingSwing: row.controllingSwing ? safeJsonParse(row.controllingSwing, null) : null,
    controllingSwingDistancePips: null,
    currentPrice: row.currentPrice,
    candlesAnalyzed: row.candlesAnalyzed,
    computedAt: row.computedAt.toISOString(),
  }))
}

/** Cleanup trend records older than N days. */
export async function cleanupOldTrends(olderThanDays = 30): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const result = await db.detectedTrend.deleteMany({
    where: { computedAt: { lt: cutoff } },
  })
  return result.count
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}
