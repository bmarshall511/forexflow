import { NextResponse, type NextRequest } from "next/server"
import { upsertTrend, getTrend } from "@fxflow/db"
import { detectTrend, getDefaultSwingStrength } from "@fxflow/shared"
import type { TrendData, TrendDetectionConfig, ZoneCandle } from "@fxflow/types"
import { fetchCandles } from "@/components/charts/chart-utils"

interface RouteParams {
  params: Promise<{ instrument: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instrument } = await params
    const sp = request.nextUrl.searchParams
    const timeframe = sp.get("timeframe") ?? "H1"
    const lookback = parseInt(sp.get("lookback") ?? "500", 10)

    // Fetch candles from OANDA
    const candles = await fetchCandles(instrument, timeframe, lookback)
    if (!candles || candles.length === 0) {
      return NextResponse.json({ ok: false, error: "No candle data available" }, { status: 404 })
    }

    const currentPrice = candles[candles.length - 1]!.close

    // Build config from query params
    const config: TrendDetectionConfig = {
      swingStrength:
        parseInt(sp.get("swingStrength") ?? "0", 10) || getDefaultSwingStrength(timeframe),
      minSegmentAtr: parseFloat(sp.get("minSegmentAtr") ?? "0.5"),
      maxSwingPoints: parseInt(sp.get("maxSwingPoints") ?? "20", 10),
      lookbackCandles: lookback,
    }

    // Run detection
    const result = detectTrend(candles as ZoneCandle[], instrument, timeframe, config, currentPrice)

    // Persist in background (non-blocking)
    upsertTrend(result).catch(() => {})

    return NextResponse.json(
      { ok: true, data: result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    )
  } catch (error) {
    console.error("[GET /api/trends/[instrument]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
