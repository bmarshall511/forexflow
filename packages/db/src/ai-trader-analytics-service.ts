/**
 * AI Trader analytics service — derives equity curve, funnel stats, and cost
 * metrics from the AiTraderOpportunity table for the Performance tab.
 *
 * Separated from ai-trader-performance-service.ts to stay within LOC limits.
 *
 * @module ai-trader-analytics-service
 */
import { db } from "./client"
import type { EquityCurvePoint } from "@fxflow/types"

// ─── Types ──────────────────────────────────────────────────────────────────

/** Pipeline funnel counts by status. */
export interface AiTraderFunnelStats {
  detected: number
  suggested: number
  approved: number
  placed: number
  filled: number
  managed: number
  closed: number
  rejected: number
  expired: number
  skipped: number
}

/** Aggregated AI cost metrics. */
export interface AiTraderCostStats {
  totalCost: number
  tier2Total: number
  tier3Total: number
  totalPL: number
  costPerTrade: number
  roi: number
  tradeCount: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function cutoffDate(daysBack: number): Date | null {
  if (daysBack <= 0) return null
  return new Date(Date.now() - daysBack * 86_400_000)
}

function dateFilter(daysBack: number): { gte: Date } | undefined {
  const cutoff = cutoffDate(daysBack)
  return cutoff ? { gte: cutoff } : undefined
}

// ─── Equity Curve ───────────────────────────────────────────────────────────

/**
 * Build an equity curve from closed AI Trader opportunities.
 * Returns chronological data points with running cumulative P&L.
 *
 * @param daysBack - Lookback window in days (0 = all time, default 90)
 */
export async function getAiTraderEquityCurve(daysBack = 90): Promise<EquityCurvePoint[]> {
  const rows = await db.aiTraderOpportunity.findMany({
    where: {
      status: "closed",
      realizedPL: { not: null },
      closedAt: { not: null, ...dateFilter(daysBack) },
    },
    select: { closedAt: true, realizedPL: true },
    orderBy: { closedAt: "asc" },
  })

  let cumPL = 0
  const pointsByDate = new Map<string, { pl: number; count: number }>()

  for (const row of rows) {
    if (row.closedAt == null || row.realizedPL == null) continue
    cumPL += row.realizedPL
    const dateKey =
      row.closedAt instanceof Date
        ? row.closedAt.toISOString().slice(0, 10)
        : new Date(row.closedAt as string | number).toISOString().slice(0, 10)

    const existing = pointsByDate.get(dateKey)
    if (existing) {
      existing.pl = cumPL
      existing.count += 1
    } else {
      pointsByDate.set(dateKey, { pl: cumPL, count: 1 })
    }
  }

  const points: EquityCurvePoint[] = []
  for (const [date, { pl, count }] of pointsByDate) {
    points.push({ date, cumulativePL: pl, tradeCount: count })
  }
  return points
}

// ─── Funnel Stats ───────────────────────────────────────────────────────────

/**
 * Count opportunities by status for the pipeline funnel visualization.
 *
 * @param daysBack - Lookback window in days (0 = all time, default 90)
 */
export async function getAiTraderFunnelStats(daysBack = 90): Promise<AiTraderFunnelStats> {
  const cutoff = dateFilter(daysBack)
  const where = cutoff ? { detectedAt: cutoff } : {}

  const rows = await db.aiTraderOpportunity.groupBy({
    by: ["status"],
    where,
    _count: { id: true },
  })

  const stats: AiTraderFunnelStats = {
    detected: 0,
    suggested: 0,
    approved: 0,
    placed: 0,
    filled: 0,
    managed: 0,
    closed: 0,
    rejected: 0,
    expired: 0,
    skipped: 0,
  }

  for (const row of rows) {
    const status = row.status as keyof AiTraderFunnelStats
    if (status in stats) {
      stats[status] = row._count.id
    }
  }

  return stats
}

// ─── Cost Stats ─────────────────────────────────────────────────────────────

/**
 * Aggregate AI spend and P&L for cost efficiency analysis.
 *
 * @param daysBack - Lookback window in days (0 = all time, default 90)
 */
// ─── Regime Stats ──────────────────────────────────────────────────────────

/** Performance breakdown by market regime. */
export interface AiTraderRegimeStat {
  regime: string
  count: number
  wins: number
  losses: number
  totalPL: number
  winRate: number
}

/**
 * Group closed opportunities by market regime to see which regimes produce wins/losses.
 *
 * @param daysBack - Lookback window in days (0 = all time, default 90)
 */
export async function getAiTraderRegimeStats(daysBack = 90): Promise<AiTraderRegimeStat[]> {
  const cutoff = dateFilter(daysBack)
  const rows = await db.aiTraderOpportunity.findMany({
    where: {
      status: "closed",
      outcome: { not: null },
      regime: { not: null },
      ...(cutoff ? { closedAt: cutoff } : {}),
    },
    select: { regime: true, outcome: true, realizedPL: true },
  })

  const map = new Map<string, { count: number; wins: number; losses: number; totalPL: number }>()
  for (const row of rows) {
    const regime = row.regime ?? "unknown"
    const entry = map.get(regime) ?? { count: 0, wins: 0, losses: 0, totalPL: 0 }
    entry.count++
    if (row.outcome === "win") entry.wins++
    if (row.outcome === "loss") entry.losses++
    entry.totalPL += row.realizedPL ?? 0
    map.set(regime, entry)
  }

  return Array.from(map.entries()).map(([regime, e]) => ({
    regime,
    ...e,
    winRate: e.count > 0 ? e.wins / e.count : 0,
  }))
}

// ─── Confidence Buckets ────────────────────────────────────────────────────

/** Performance grouped by confidence range. */
export interface AiTraderConfidenceBucket {
  bucket: string
  min: number
  max: number
  count: number
  wins: number
  losses: number
  totalPL: number
  winRate: number
}

/**
 * Group closed opportunities by confidence bucket to validate scoring quality.
 *
 * @param daysBack - Lookback window in days (0 = all time, default 90)
 */
export async function getAiTraderConfidenceBuckets(
  daysBack = 90,
): Promise<AiTraderConfidenceBucket[]> {
  const cutoff = dateFilter(daysBack)
  const rows = await db.aiTraderOpportunity.findMany({
    where: {
      status: "closed",
      outcome: { not: null },
      ...(cutoff ? { closedAt: cutoff } : {}),
    },
    select: { confidence: true, outcome: true, realizedPL: true },
  })

  const BUCKETS = [
    { bucket: "50-60", min: 50, max: 60 },
    { bucket: "60-70", min: 60, max: 70 },
    { bucket: "70-80", min: 70, max: 80 },
    { bucket: "80+", min: 80, max: 101 },
  ]

  const result: AiTraderConfidenceBucket[] = BUCKETS.map((b) => ({
    ...b,
    count: 0,
    wins: 0,
    losses: 0,
    totalPL: 0,
    winRate: 0,
  }))

  for (const row of rows) {
    const bucket = result.find((b) => row.confidence >= b.min && row.confidence < b.max)
    if (!bucket) continue
    bucket.count++
    if (row.outcome === "win") bucket.wins++
    if (row.outcome === "loss") bucket.losses++
    bucket.totalPL += row.realizedPL ?? 0
  }

  for (const b of result) {
    b.winRate = b.count > 0 ? b.wins / b.count : 0
  }

  return result
}

// ─── MFE/MAE Data ──────────────────────────────────────────────────────────

/** MFE/MAE data point for a closed AI trade. */
export interface AiTraderMfeMaePoint {
  instrument: string
  direction: string
  mfe: number
  mae: number
  riskPips: number
  rewardPips: number
  outcome: string
  realizedPL: number
}

/**
 * Get MFE/MAE data by joining opportunities with trades.
 *
 * @param daysBack - Lookback window in days (0 = all time, default 90)
 */
export async function getAiTraderMfeMaeData(daysBack = 90): Promise<AiTraderMfeMaePoint[]> {
  const cutoff = dateFilter(daysBack)
  const opps = await db.aiTraderOpportunity.findMany({
    where: {
      status: "closed",
      outcome: { not: null },
      resultTradeId: { not: null },
      ...(cutoff ? { closedAt: cutoff } : {}),
    },
    select: {
      instrument: true,
      direction: true,
      riskPips: true,
      rewardPips: true,
      outcome: true,
      realizedPL: true,
      resultTradeId: true,
    },
  })

  const tradeIds = opps.map((o) => o.resultTradeId!).filter(Boolean)
  if (tradeIds.length === 0) return []

  const trades = await db.trade.findMany({
    where: { id: { in: tradeIds } },
    select: { id: true, mfe: true, mae: true },
  })

  const tradeMap = new Map(trades.map((t) => [t.id, t]))

  return opps
    .map((o) => {
      const trade = tradeMap.get(o.resultTradeId!)
      if (!trade) return null
      return {
        instrument: o.instrument,
        direction: o.direction,
        mfe: trade.mfe ?? 0,
        mae: trade.mae ?? 0,
        riskPips: o.riskPips,
        rewardPips: o.rewardPips,
        outcome: o.outcome!,
        realizedPL: o.realizedPL ?? 0,
      }
    })
    .filter((x): x is AiTraderMfeMaePoint => x !== null)
}

// ─── Closed Trades List ────────────────────────────────────────────────────

/** Full closed opportunity record for the trade log table. */
export interface AiTraderClosedTrade {
  id: string
  instrument: string
  direction: string
  profile: string
  confidence: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskRewardRatio: number
  realizedPL: number
  outcome: string
  regime: string | null
  session: string | null
  entryRationale: string | null
  scoresJson: string
  managementLog: string
  detectedAt: string
  filledAt: string | null
  closedAt: string | null
  mfe: number
  mae: number
}

/**
 * Get closed AI trades with MFE/MAE for the trade log table.
 *
 * @param daysBack - Lookback window in days (0 = all time, default 90)
 */
export async function getAiTraderClosedTrades(daysBack = 90): Promise<AiTraderClosedTrade[]> {
  const cutoff = dateFilter(daysBack)
  const opps = await db.aiTraderOpportunity.findMany({
    where: {
      status: "closed",
      outcome: { not: null },
      ...(cutoff ? { closedAt: cutoff } : {}),
    },
    orderBy: { closedAt: "desc" },
    take: 100,
  })

  const tradeIds = opps.map((o) => o.resultTradeId).filter(Boolean) as string[]
  const trades =
    tradeIds.length > 0
      ? await db.trade.findMany({
          where: { id: { in: tradeIds } },
          select: { id: true, mfe: true, mae: true },
        })
      : []
  const tradeMap = new Map(trades.map((t) => [t.id, t]))

  return opps.map((o) => {
    const trade = o.resultTradeId ? tradeMap.get(o.resultTradeId) : null
    return {
      id: o.id,
      instrument: o.instrument,
      direction: o.direction,
      profile: o.profile,
      confidence: o.confidence,
      entryPrice: o.entryPrice,
      stopLoss: o.stopLoss,
      takeProfit: o.takeProfit,
      riskRewardRatio: o.riskRewardRatio,
      realizedPL: o.realizedPL ?? 0,
      outcome: o.outcome ?? "unknown",
      regime: o.regime,
      session: o.session,
      entryRationale: o.entryRationale,
      scoresJson: typeof o.scoresJson === "string" ? o.scoresJson : JSON.stringify(o.scoresJson),
      managementLog:
        typeof o.managementLog === "string" ? o.managementLog : JSON.stringify(o.managementLog),
      detectedAt: o.detectedAt instanceof Date ? o.detectedAt.toISOString() : String(o.detectedAt),
      filledAt: o.filledAt
        ? o.filledAt instanceof Date
          ? o.filledAt.toISOString()
          : String(o.filledAt)
        : null,
      closedAt: o.closedAt
        ? o.closedAt instanceof Date
          ? o.closedAt.toISOString()
          : String(o.closedAt)
        : null,
      mfe: trade?.mfe ?? 0,
      mae: trade?.mae ?? 0,
    }
  })
}

// ─── Cost Stats ─────────────────────────────────────────────────────────

export async function getAiTraderCostStats(daysBack = 90): Promise<AiTraderCostStats> {
  const cutoff = dateFilter(daysBack)
  const where = cutoff ? { detectedAt: cutoff } : {}

  const agg = await db.aiTraderOpportunity.aggregate({
    where,
    _sum: { tier2Cost: true, tier3Cost: true, realizedPL: true },
    _count: { id: true },
  })

  const tier2Total = agg._sum.tier2Cost ?? 0
  const tier3Total = agg._sum.tier3Cost ?? 0
  const totalCost = tier2Total + tier3Total
  const totalPL = agg._sum.realizedPL ?? 0
  const tradeCount = agg._count.id

  return {
    totalCost,
    tier2Total,
    tier3Total,
    totalPL,
    costPerTrade: tradeCount > 0 ? totalCost / tradeCount : 0,
    roi: totalCost > 0 ? totalPL / totalCost : 0,
    tradeCount,
  }
}
