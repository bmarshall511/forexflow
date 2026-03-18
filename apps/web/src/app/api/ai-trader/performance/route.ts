import { type NextRequest, NextResponse } from "next/server"
import {
  getPerformanceStats,
  getOverallStats,
  getAiTraderEquityCurve,
  getAiTraderFunnelStats,
  getAiTraderCostStats,
  getAiTraderRegimeStats,
  getAiTraderConfidenceBuckets,
  getAiTraderMfeMaeData,
  getAiTraderClosedTrades,
} from "@fxflow/db"
import type {
  AiTraderStrategyPerformanceData,
  EquityCurvePoint,
  AiTraderProfile,
} from "@fxflow/types"
import type {
  AiTraderFunnelStats,
  AiTraderCostStats,
  AiTraderRegimeStat,
  AiTraderConfidenceBucket,
  AiTraderMfeMaePoint,
  AiTraderClosedTrade,
} from "@fxflow/db"

interface PerformanceResponse {
  stats: AiTraderStrategyPerformanceData[]
  overall: AiTraderStrategyPerformanceData | null
  equityCurve: EquityCurvePoint[]
  funnel: AiTraderFunnelStats
  costs: AiTraderCostStats
  regimeStats: AiTraderRegimeStat[]
  confidenceBuckets: AiTraderConfidenceBucket[]
  mfeMaeData: AiTraderMfeMaePoint[]
  closedTrades: AiTraderClosedTrade[]
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const daysBack = parseInt(params.get("daysBack") ?? "90", 10)
    const profile = params.get("profile") as AiTraderProfile | null

    const [
      stats,
      overall,
      equityCurve,
      funnel,
      costs,
      regimeStats,
      confidenceBuckets,
      mfeMaeData,
      closedTrades,
    ] = await Promise.all([
      getPerformanceStats({ daysBack, ...(profile ? { profile } : {}) }),
      getOverallStats(daysBack),
      getAiTraderEquityCurve(daysBack),
      getAiTraderFunnelStats(daysBack),
      getAiTraderCostStats(daysBack),
      getAiTraderRegimeStats(daysBack),
      getAiTraderConfidenceBuckets(daysBack),
      getAiTraderMfeMaeData(daysBack),
      getAiTraderClosedTrades(daysBack),
    ])

    return NextResponse.json<{ ok: true; data: PerformanceResponse }>({
      ok: true,
      data: {
        stats,
        overall,
        equityCurve,
        funnel,
        costs,
        regimeStats,
        confidenceBuckets,
        mfeMaeData,
        closedTrades,
      },
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/performance]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
