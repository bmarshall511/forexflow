import { NextResponse, type NextRequest } from "next/server"
import {
  getTradeFinderPerformance,
  getTradeFinderOverallStats,
  type TradeFinderPerformanceData,
} from "@fxflow/db"

interface PerformanceResponse {
  overall: TradeFinderPerformanceData | null
  byTimeframe: TradeFinderPerformanceData[]
  byInstrument: TradeFinderPerformanceData[]
  byScoreRange: TradeFinderPerformanceData[]
  bySession: TradeFinderPerformanceData[]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const daysBack = parseInt(request.nextUrl.searchParams.get("daysBack") ?? "90", 10)

    const [overall, byTimeframe, byInstrument, byScoreRange, bySession] = await Promise.all([
      getTradeFinderOverallStats(daysBack),
      getTradeFinderPerformance({ dimension: "timeframe", daysBack }),
      getTradeFinderPerformance({ dimension: "instrument", daysBack }),
      getTradeFinderPerformance({ dimension: "score_range", daysBack }),
      getTradeFinderPerformance({ dimension: "session", daysBack }),
    ])

    const data: PerformanceResponse = {
      overall,
      byTimeframe,
      byInstrument,
      byScoreRange,
      bySession,
    }
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[GET /api/trade-finder/performance]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
