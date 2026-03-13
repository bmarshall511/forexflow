import { NextResponse, type NextRequest } from "next/server"
import { revealToken, getSettings } from "@fxflow/db"
import type { TradingMode } from "@fxflow/types"

const OANDA_URLS: Record<TradingMode, string> = {
  practice: "https://api-fxpractice.oanda.com",
  live: "https://api-fxtrade.oanda.com",
}

interface OandaCandle {
  complete: boolean
  volume: number
  time: string
  mid: { o: string; h: string; l: string; c: string }
}

interface OandaCandlesResponse {
  instrument: string
  granularity: string
  candles: OandaCandle[]
}

export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instrument: string }> },
): Promise<NextResponse> {
  try {
    const { instrument } = await params
    const { searchParams } = request.nextUrl
    const granularity = searchParams.get("granularity") ?? "H1"
    const count = searchParams.get("count") ?? "100"

    const settings = await getSettings()
    const mode = settings.tradingMode
    const token = await revealToken(mode)
    const baseUrl = OANDA_URLS[mode]

    const to = searchParams.get("to") // ISO 8601 timestamp — fetch candles BEFORE this time
    let url = `${baseUrl}/v3/instruments/${instrument}/candles?granularity=${granularity}&count=${count}&price=M`
    if (to) url += `&to=${encodeURIComponent(to)}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const body = await response.text()
      return NextResponse.json(
        { ok: false, error: `OANDA ${response.status}: ${body}` },
        { status: response.status },
      )
    }

    const data = (await response.json()) as OandaCandlesResponse
    const candles: CandleData[] = data.candles
      .filter((c) => c.complete)
      .map((c) => ({
        time: Math.floor(new Date(c.time).getTime() / 1000),
        open: parseFloat(c.mid.o),
        high: parseFloat(c.mid.h),
        low: parseFloat(c.mid.l),
        close: parseFloat(c.mid.c),
      }))

    return NextResponse.json(
      { ok: true, data: candles },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    )
  } catch (error) {
    console.error("[GET /api/candles/[instrument]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
