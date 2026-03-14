import { NextResponse, type NextRequest } from "next/server"
import { getTradeWithDetails, revealToken, getSettings } from "@fxflow/db"
import type { TradingMode, Timeframe } from "@fxflow/types"

const OANDA_URLS: Record<TradingMode, string> = {
  practice: "https://api-fxpractice.oanda.com",
  live: "https://api-fxtrade.oanda.com",
}

/** Seconds per candle for each timeframe */
const TF_SECONDS: Record<string, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D: 86400,
  W: 604800,
  M: 2592000,
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

export interface ReplayCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface ReplayTradeInfo {
  entryPrice: number
  exitPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  direction: string
  openedAt: string
  closedAt: string | null
  outcome: string | null
  closeReason: string | null
  instrument: string
  timeframe: string
}

export interface ReplayResponse {
  candles: ReplayCandle[]
  trade: ReplayTradeInfo
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse> {
  try {
    const { tradeId } = await params
    const detail = await getTradeWithDetails(tradeId)

    if (!detail) {
      return NextResponse.json({ ok: false, error: "Trade not found" }, { status: 404 })
    }

    if (detail.status !== "closed" || !detail.closedAt) {
      return NextResponse.json(
        { ok: false, error: "Replay is only available for closed trades" },
        { status: 400 },
      )
    }

    const tfParam = request.nextUrl.searchParams.get("timeframe")
    const timeframe: Timeframe = (tfParam as Timeframe) ?? detail.timeframe ?? "M15"
    const tfSecs = TF_SECONDS[timeframe] ?? 900

    // Compute padded time window: 50 candles before entry, 20 after exit
    const openMs = new Date(detail.openedAt).getTime()
    const closeMs = new Date(detail.closedAt).getTime()
    const fromMs = openMs - 50 * tfSecs * 1000
    const toMs = closeMs + 20 * tfSecs * 1000

    const fromISO = new Date(fromMs).toISOString()
    const toISO = new Date(toMs).toISOString()

    // Fetch candles from OANDA
    const settings = await getSettings()
    const mode = settings.tradingMode
    const token = await revealToken(mode)
    const baseUrl = OANDA_URLS[mode]

    const url =
      `${baseUrl}/v3/instruments/${detail.instrument}/candles` +
      `?granularity=${timeframe}&from=${encodeURIComponent(fromISO)}` +
      `&to=${encodeURIComponent(toISO)}&price=M`

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
    const candles: ReplayCandle[] = data.candles
      .filter((c) => c.complete)
      .map((c) => ({
        time: Math.floor(new Date(c.time).getTime() / 1000),
        open: parseFloat(c.mid.o),
        high: parseFloat(c.mid.h),
        low: parseFloat(c.mid.l),
        close: parseFloat(c.mid.c),
      }))

    const tradeInfo: ReplayTradeInfo = {
      entryPrice: detail.entryPrice,
      exitPrice: detail.exitPrice,
      stopLoss: detail.stopLoss,
      takeProfit: detail.takeProfit,
      direction: detail.direction,
      openedAt: detail.openedAt,
      closedAt: detail.closedAt,
      outcome: detail.closeReason ? (detail.realizedPL >= 0 ? "win" : "loss") : null,
      closeReason: detail.closeReason,
      instrument: detail.instrument,
      timeframe,
    }

    return NextResponse.json(
      { ok: true, candles, trade: tradeInfo } satisfies { ok: true } & ReplayResponse,
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    )
  } catch (error) {
    console.error("[GET /api/trades/[tradeId]/replay-candles]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
