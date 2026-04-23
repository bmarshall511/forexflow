/**
 * Trade Finder performance tracking service.
 *
 * Records and queries performance metrics for Trade Finder trades across
 * multiple dimensions: overall, per-timeframe, per-instrument, per-score-range.
 *
 * @module trade-finder-performance-service
 */
import { db } from "./client"
import type { TradingMode } from "@fxflow/types"

export interface TradeFinderPerformanceData {
  dimension: string
  dimensionKey: string | null
  totalSetups: number
  placed: number
  filled: number
  wins: number
  losses: number
  breakevens: number
  winRate: number
  totalPL: number
  avgRR: number
  expectedRR: number
  profitFactor: number
  expectancy: number
  maxDrawdown: number
  periodStart: string
  periodEnd: string
}

export interface RecordOutcomeInput {
  /** OANDA account the trade was placed on. */
  account: TradingMode
  timeframeSet: string
  instrument: string
  scoreTotal: number
  maxPossible: number
  expectedRR: number
  actualRR: number
  realizedPL: number
  outcome: "win" | "loss" | "breakeven"
  /** Trading session at time of entry (for session dimension tracking) */
  session?: string | null
}

function toData(row: {
  dimension: string
  dimensionKey: string | null
  totalSetups: number
  placed: number
  filled: number
  wins: number
  losses: number
  breakevens: number
  totalPL: number
  avgRR: number
  expectedRR: number
  profitFactor: number
  expectancy: number
  maxDrawdown: number
  periodStart: Date
  periodEnd: Date
}): TradeFinderPerformanceData {
  const total = row.wins + row.losses + row.breakevens
  return {
    ...row,
    winRate: total > 0 ? (row.wins / total) * 100 : 0,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
  }
}

/** Get performance stats for a given period */
export async function getTradeFinderPerformance(options?: {
  dimension?: string
  dimensionKey?: string
  daysBack?: number
  account?: TradingMode
}): Promise<TradeFinderPerformanceData[]> {
  const where: Record<string, unknown> = {}
  if (options?.dimension) where.dimension = options.dimension
  if (options?.dimensionKey) where.dimensionKey = options.dimensionKey
  if (options?.account) where.account = options.account
  if (options?.daysBack && options.daysBack > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - options.daysBack)
    where.periodStart = { gte: cutoff }
  }

  const rows = await db.tradeFinderPerformance.findMany({
    where,
    orderBy: { periodStart: "desc" },
  })
  return rows.map(toData)
}

/** Get overall aggregate stats */
export async function getTradeFinderOverallStats(
  daysBack = 90,
): Promise<TradeFinderPerformanceData | null> {
  const stats = await getTradeFinderPerformance({ dimension: "overall", daysBack })
  if (stats.length === 0) return null

  // Aggregate across all monthly periods
  let wins = 0,
    losses = 0,
    breakevens = 0,
    totalPL = 0,
    rrSum = 0,
    expRRSum = 0,
    count = 0
  for (const s of stats) {
    wins += s.wins
    losses += s.losses
    breakevens += s.breakevens
    totalPL += s.totalPL
    rrSum += s.avgRR * (s.wins + s.losses + s.breakevens)
    expRRSum += s.expectedRR * (s.wins + s.losses + s.breakevens)
    count += s.wins + s.losses + s.breakevens
  }

  const total = wins + losses + breakevens
  const grossWins = stats.reduce((sum, s) => sum + (s.totalPL > 0 ? s.totalPL : 0), 0)
  const grossLosses = Math.abs(stats.reduce((sum, s) => sum + (s.totalPL < 0 ? s.totalPL : 0), 0))

  return {
    dimension: "overall",
    dimensionKey: null,
    totalSetups: stats.reduce((s, r) => s + r.totalSetups, 0),
    placed: stats.reduce((s, r) => s + r.placed, 0),
    filled: stats.reduce((s, r) => s + r.filled, 0),
    wins,
    losses,
    breakevens,
    winRate: total > 0 ? (wins / total) * 100 : 0,
    totalPL,
    avgRR: count > 0 ? rrSum / count : 0,
    expectedRR: count > 0 ? expRRSum / count : 0,
    profitFactor: grossLosses > 0 ? Math.min(99, grossWins / grossLosses) : grossWins > 0 ? 99 : 0,
    expectancy:
      total > 0
        ? (wins / total) * (totalPL > 0 ? totalPL / Math.max(wins, 1) : 0) -
          (losses / total) * (totalPL < 0 ? Math.abs(totalPL) / Math.max(losses, 1) : 0)
        : 0,
    maxDrawdown: Math.min(...stats.map((s) => s.maxDrawdown), 0),
    periodStart: stats[stats.length - 1]?.periodStart ?? new Date().toISOString(),
    periodEnd: stats[0]?.periodEnd ?? new Date().toISOString(),
  }
}

/** Record a trade outcome into performance stats (called when Trade Finder trade closes) */
export async function recordTradeFinderOutcome(input: RecordOutcomeInput): Promise<void> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  // Score range bucket
  const scorePct = input.maxPossible > 0 ? input.scoreTotal / input.maxPossible : 0
  const scoreRange = scorePct >= 0.81 ? "13-16" : scorePct >= 0.63 ? "10-12" : "7-9"

  // Record into 4-5 dimension combos (session is optional)
  const dimensions: { dimension: string; dimensionKey: string | null }[] = [
    { dimension: "overall", dimensionKey: null },
    { dimension: "timeframe", dimensionKey: input.timeframeSet },
    { dimension: "instrument", dimensionKey: input.instrument },
    { dimension: "score_range", dimensionKey: scoreRange },
  ]
  if (input.session) {
    dimensions.push({ dimension: "session", dimensionKey: input.session })
  }

  await Promise.all(
    dimensions.map(({ dimension, dimensionKey }) =>
      upsertPerformanceRecord(dimension, dimensionKey, periodStart, periodEnd, input),
    ),
  )
}

async function upsertPerformanceRecord(
  dimension: string,
  dimensionKey: string | null,
  periodStart: Date,
  periodEnd: Date,
  input: RecordOutcomeInput,
): Promise<void> {
  // Find existing record for this period — scoped by account so practice and
  // live aggregates stay isolated even under the same dimension key.
  const existing = await db.tradeFinderPerformance.findFirst({
    where: { dimension, dimensionKey, periodStart, account: input.account },
  })

  const isWin = input.outcome === "win"
  const isLoss = input.outcome === "loss"

  if (existing) {
    const newWins = existing.wins + (isWin ? 1 : 0)
    const newLosses = existing.losses + (isLoss ? 1 : 0)
    const newBE = existing.breakevens + (input.outcome === "breakeven" ? 1 : 0)
    const newTotal = newWins + newLosses + newBE
    const newPL = existing.totalPL + input.realizedPL

    // Recalculate running max drawdown
    let maxDD = existing.maxDrawdown
    if (newPL < maxDD) maxDD = newPL

    // Weighted average R:R
    const oldCount = existing.wins + existing.losses + existing.breakevens
    const newAvgRR =
      newTotal > 0 ? (existing.avgRR * oldCount + input.actualRR) / newTotal : input.actualRR
    const newExpRR =
      newTotal > 0
        ? (existing.expectedRR * oldCount + input.expectedRR) / newTotal
        : input.expectedRR

    // Profit factor
    const grossWins = existing.totalPL > 0 ? existing.totalPL : 0
    const grossLosses = Math.abs(existing.totalPL < 0 ? existing.totalPL : 0)
    const addWin = input.realizedPL > 0 ? input.realizedPL : 0
    const addLoss = Math.abs(input.realizedPL < 0 ? input.realizedPL : 0)
    const totalGrossWins = grossWins + addWin
    const totalGrossLosses = grossLosses + addLoss
    const pf = totalGrossLosses > 0 ? Math.min(99, totalGrossWins / totalGrossLosses) : 99

    await db.tradeFinderPerformance.update({
      where: { id: existing.id },
      data: {
        filled: existing.filled + 1,
        wins: newWins,
        losses: newLosses,
        breakevens: newBE,
        totalPL: newPL,
        avgRR: newAvgRR,
        expectedRR: newExpRR,
        profitFactor: pf,
        maxDrawdown: maxDD,
      },
    })
  } else {
    await db.tradeFinderPerformance.create({
      data: {
        account: input.account,
        dimension,
        dimensionKey,
        periodStart,
        periodEnd,
        filled: 1,
        wins: isWin ? 1 : 0,
        losses: isLoss ? 1 : 0,
        breakevens: input.outcome === "breakeven" ? 1 : 0,
        totalPL: input.realizedPL,
        avgRR: input.actualRR,
        expectedRR: input.expectedRR,
        profitFactor: input.realizedPL > 0 ? 99 : 0,
        maxDrawdown: Math.min(0, input.realizedPL),
      },
    })
  }
}

/** Clean up performance records older than specified days */
export async function cleanupOldPerformance(days = 180): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const result = await db.tradeFinderPerformance.deleteMany({
    where: { periodStart: { lt: cutoff } },
  })
  return result.count
}
