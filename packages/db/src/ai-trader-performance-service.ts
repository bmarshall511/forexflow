/**
 * AI Trader performance service — tracks and aggregates strategy performance metrics.
 *
 * Records per-profile, per-instrument, per-session, and per-technique performance
 * snapshots with win rate, profit factor, expectancy, and max drawdown.
 * Supports recalculation from raw trade data and time-windowed queries.
 *
 * @module ai-trader-performance-service
 */
import { db } from "./client"
import type { AiTraderProfile, AiTraderStrategyPerformanceData } from "@fxflow/types"

// ─── Input Types ────────────────────────────────────────────────────────────

/** Fields required to upsert a performance stats record. */
export interface UpsertPerformanceInput {
  profile: AiTraderProfile
  instrument: string | null
  session: string | null
  technique: string | null
  periodStart: Date
  periodEnd: Date
  totalTrades: number
  wins: number
  losses: number
  breakevens: number
  totalPL: number
  avgRR: number
  profitFactor: number
  expectancy: number
  maxDrawdown: number
}

/** Minimal trade data needed for performance recalculation. */
export interface TradeStatsInput {
  realizedPL: number
  riskRewardRatio: number
  outcome: "win" | "loss" | "breakeven" | "cancelled"
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map a Prisma performance row to the `AiTraderStrategyPerformanceData` DTO,
 * computing win rate from total trades and wins.
 *
 * @param row - Raw performance row from Prisma
 * @returns Serialized performance data
 */
function toData(row: {
  profile: string
  instrument: string | null
  session: string | null
  technique: string | null
  totalTrades: number
  wins: number
  losses: number
  breakevens: number
  totalPL: number
  avgRR: number
  profitFactor: number
  expectancy: number
  maxDrawdown: number
  periodStart: Date
  periodEnd: Date
}): AiTraderStrategyPerformanceData {
  return {
    profile: row.profile as AiTraderProfile,
    instrument: row.instrument,
    session: row.session as AiTraderStrategyPerformanceData["session"],
    technique: row.technique as AiTraderStrategyPerformanceData["technique"],
    totalTrades: row.totalTrades,
    wins: row.wins,
    losses: row.losses,
    breakevens: row.breakevens,
    winRate: row.totalTrades > 0 ? row.wins / row.totalTrades : 0,
    totalPL: row.totalPL,
    avgRR: row.avgRR,
    profitFactor: row.profitFactor,
    expectancy: row.expectancy,
    maxDrawdown: row.maxDrawdown,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get performance stats with optional filters. Defaults to last 90 days.
 *
 * @param options - Optional filters for profile, instrument, session, and time window
 * @returns Array of performance data records
 */
export async function getPerformanceStats(options?: {
  profile?: AiTraderProfile
  instrument?: string
  session?: string
  daysBack?: number
}): Promise<AiTraderStrategyPerformanceData[]> {
  const daysBack = options?.daysBack ?? 90
  const cutoff = new Date(Date.now() - daysBack * 86_400_000)

  const rows = await db.aiTraderStrategyPerformance.findMany({
    where: {
      ...(options?.profile ? { profile: options.profile } : {}),
      ...(options?.instrument ? { instrument: options.instrument } : {}),
      ...(options?.session ? { session: options.session } : {}),
      periodStart: { gte: cutoff },
    },
    orderBy: { periodStart: "desc" },
  })

  return rows.map(toData)
}

/**
 * Get aggregated overall performance stats across all profiles (excluding per-instrument breakdowns).
 *
 * @param daysBack - Number of days to look back (default: 90)
 * @returns Aggregated performance data, or null if no trades in the period
 */
export async function getOverallStats(
  daysBack = 90,
): Promise<AiTraderStrategyPerformanceData | null> {
  const cutoff = new Date(Date.now() - daysBack * 86_400_000)

  const agg = await db.aiTraderStrategyPerformance.aggregate({
    where: {
      instrument: null,
      session: null,
      technique: null,
      periodStart: { gte: cutoff },
    },
    _sum: { totalTrades: true, wins: true, losses: true, breakevens: true, totalPL: true },
    _avg: { avgRR: true, profitFactor: true, expectancy: true },
    _max: { maxDrawdown: true, periodEnd: true },
    _min: { periodStart: true },
  })

  const total = agg._sum.totalTrades ?? 0
  if (total === 0) return null

  return {
    profile: "intraday" as AiTraderProfile, // aggregate placeholder
    instrument: null,
    session: null,
    technique: null,
    totalTrades: total,
    wins: agg._sum.wins ?? 0,
    losses: agg._sum.losses ?? 0,
    breakevens: agg._sum.breakevens ?? 0,
    winRate: total > 0 ? (agg._sum.wins ?? 0) / total : 0,
    totalPL: agg._sum.totalPL ?? 0,
    avgRR: agg._avg.avgRR ?? 0,
    profitFactor: agg._avg.profitFactor ?? 0,
    expectancy: agg._avg.expectancy ?? 0,
    maxDrawdown: agg._max.maxDrawdown ?? 0,
    periodStart: agg._min.periodStart?.toISOString() ?? new Date().toISOString(),
    periodEnd: agg._max.periodEnd?.toISOString() ?? new Date().toISOString(),
  }
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Upsert a performance stats record. Matches on profile+instrument+session+technique+periodStart.
 *
 * @param input - Performance data to upsert
 */
export async function upsertPerformanceStats(input: UpsertPerformanceInput): Promise<void> {
  const existing = await db.aiTraderStrategyPerformance.findFirst({
    where: {
      profile: input.profile,
      instrument: input.instrument,
      session: input.session,
      technique: input.technique,
      periodStart: input.periodStart,
    },
  })

  const data = {
    profile: input.profile,
    instrument: input.instrument,
    session: input.session,
    technique: input.technique,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalTrades: input.totalTrades,
    wins: input.wins,
    losses: input.losses,
    breakevens: input.breakevens,
    totalPL: input.totalPL,
    avgRR: input.avgRR,
    profitFactor: input.profitFactor,
    expectancy: input.expectancy,
    maxDrawdown: input.maxDrawdown,
  }

  if (existing) {
    await db.aiTraderStrategyPerformance.update({ where: { id: existing.id }, data })
  } else {
    await db.aiTraderStrategyPerformance.create({ data })
  }
}

/**
 * Recalculate performance metrics from raw trade data and upsert the result.
 * Computes win rate, profit factor, expectancy, average R:R, and max drawdown.
 *
 * @param profile - Strategy profile
 * @param instrument - Instrument filter (null for aggregate)
 * @param session - Session filter (null for aggregate)
 * @param technique - Technique filter (null for aggregate)
 * @param periodStart - Start of the measurement period
 * @param periodEnd - End of the measurement period
 * @param trades - Array of trade results to compute metrics from
 */
export async function recalculatePerformance(
  profile: AiTraderProfile,
  instrument: string | null,
  session: string | null,
  technique: string | null,
  periodStart: Date,
  periodEnd: Date,
  trades: TradeStatsInput[],
): Promise<void> {
  // Exclude cancelled (unfilled) orders from performance metrics
  const filledTrades = trades.filter((t) => t.outcome !== "cancelled")
  const totalTrades = filledTrades.length
  if (totalTrades === 0) return

  const wins = filledTrades.filter((t) => t.outcome === "win").length
  const losses = filledTrades.filter((t) => t.outcome === "loss").length
  const breakevens = filledTrades.filter((t) => t.outcome === "breakeven").length

  const winTrades = filledTrades.filter((t) => t.outcome === "win")
  const lossTrades = filledTrades.filter((t) => t.outcome === "loss")

  const grossProfit = winTrades.reduce((s, t) => s + t.realizedPL, 0)
  const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.realizedPL, 0))
  const profitFactor =
    grossLoss === 0 ? Math.min(grossProfit > 0 ? 99 : 0, 99) : grossProfit / grossLoss

  const avgWin = winTrades.length > 0 ? grossProfit / winTrades.length : 0
  const avgLoss = lossTrades.length > 0 ? grossLoss / lossTrades.length : 0
  const winRate = wins / totalTrades
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss

  const avgRR = trades.reduce((s, t) => s + t.riskRewardRatio, 0) / totalTrades
  const totalPL = trades.reduce((s, t) => s + t.realizedPL, 0)

  // Max drawdown: peak-to-trough on running P&L
  let peak = 0
  let runningPL = 0
  let maxDrawdown = 0
  for (const t of trades) {
    runningPL += t.realizedPL
    if (runningPL > peak) peak = runningPL
    const drawdown = peak - runningPL
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  await upsertPerformanceStats({
    profile,
    instrument,
    session,
    technique,
    periodStart,
    periodEnd,
    totalTrades,
    wins,
    losses,
    breakevens,
    totalPL,
    avgRR,
    profitFactor,
    expectancy,
    maxDrawdown,
  })
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Delete performance records older than the specified number of days.
 *
 * @param days - Age threshold in days (default: 180)
 * @returns Number of records deleted
 */
export async function cleanupOldPerformance(days = 180): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000)
  const result = await db.aiTraderStrategyPerformance.deleteMany({
    where: { periodEnd: { lt: cutoff } },
  })
  return result.count
}
