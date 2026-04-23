import { NextResponse, type NextRequest } from "next/server"
import {
  getTradeFinderPerformance,
  getTradeFinderOverallStats,
  getSettings,
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
    const settings = await getSettings()
    const account = settings.tradingMode

    const [overall, byTimeframe, byInstrument, byScoreRange, bySession] = await Promise.all([
      getTradeFinderOverallStats(daysBack, account),
      getTradeFinderPerformance({ dimension: "timeframe", daysBack, account }),
      getTradeFinderPerformance({ dimension: "instrument", daysBack, account }),
      getTradeFinderPerformance({ dimension: "score_range", daysBack, account }),
      getTradeFinderPerformance({ dimension: "session", daysBack, account }),
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
