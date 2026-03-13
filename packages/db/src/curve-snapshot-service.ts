import { db } from "./client"
import type { CurveData } from "@fxflow/types"

/** Persist a curve computation snapshot — one row per instrument+timeframe (latest wins). */
export async function upsertCurveSnapshot(instrument: string, data: CurveData): Promise<void> {
  const existing = await db.curveSnapshot.findFirst({
    where: { instrument, timeframe: data.timeframe },
    orderBy: { computedAt: "desc" },
  })

  const payload = {
    instrument,
    timeframe: data.timeframe,
    supplyDistal: data.supplyDistal,
    demandDistal: data.demandDistal,
    highThreshold: data.highThreshold,
    lowThreshold: data.lowThreshold,
    position: data.position,
    currentPrice: data.supplyDistal, // Approximate — actual price embedded in position
    computedAt: new Date(),
  }

  if (existing) {
    await db.curveSnapshot.update({
      where: { id: existing.id },
      data: payload,
    })
  } else {
    await db.curveSnapshot.create({ data: payload })
  }
}

/** Get the most recent curve snapshot for an instrument+timeframe. */
export async function getCurveSnapshot(instrument: string, timeframe: string) {
  return db.curveSnapshot.findFirst({
    where: { instrument, timeframe },
    orderBy: { computedAt: "desc" },
  })
}

/** Cleanup curve snapshots older than N days. */
export async function cleanupOldCurveSnapshots(olderThanDays = 30): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const result = await db.curveSnapshot.deleteMany({
    where: { computedAt: { lt: cutoff } },
  })
  return result.count
}
