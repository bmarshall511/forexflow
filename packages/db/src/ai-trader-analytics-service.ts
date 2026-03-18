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
