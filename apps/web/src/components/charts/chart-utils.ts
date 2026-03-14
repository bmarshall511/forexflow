import type { DeepPartial } from "lightweight-charts"
import type { ChartOptions, CandlestickStyleOptions, SeriesOptionsCommon } from "lightweight-charts"
import { getChartTheme } from "@/lib/chart-theme"

export interface CandleApiData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

/** Sensible candle counts per timeframe */
export const CANDLE_COUNTS: Record<string, number> = {
  M1: 500,
  M5: 500,
  M15: 300,
  M30: 300,
  H1: 200,
  H4: 200,
  D: 120,
  W: 104,
  M: 60,
}

/** Chart options respecting current theme */
export function getChartOptions(isDark: boolean, height: number): DeepPartial<ChartOptions> {
  const theme = getChartTheme(isDark)
  return {
    height,
    layout: {
      background: { color: theme.background },
      textColor: theme.text,
      fontSize: 10,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      horzLine: { labelBackgroundColor: theme.crosshair },
      vertLine: { labelBackgroundColor: theme.crosshair },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
  }
}

/** Candlestick series options respecting current theme */
export function getCandlestickOptions(
  isDark: boolean,
  decimals: number,
  minMove: number,
): DeepPartial<CandlestickStyleOptions & SeriesOptionsCommon> {
  const theme = getChartTheme(isDark)
  return {
    upColor: theme.upCandle,
    downColor: theme.downCandle,
    borderUpColor: theme.upCandle,
    borderDownColor: theme.downCandle,
    wickUpColor: theme.upWick,
    wickDownColor: theme.downWick,
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: { type: "price", precision: decimals, minMove },
  }
}

/** Fetch candles from the API with retry */
export async function fetchCandles(
  instrument: string,
  granularity: string,
  count?: number,
  to?: string,
): Promise<CandleApiData[] | null> {
  const c = count ?? CANDLE_COUNTS[granularity] ?? 80
  let url = `/api/candles/${instrument}?granularity=${granularity}&count=${c}`
  if (to) url += `&to=${encodeURIComponent(to)}`

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt))
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch candles")
      const json = (await res.json()) as { ok: boolean; data?: CandleApiData[]; error?: string }
      if (!json.ok || !json.data) throw new Error(json.error ?? "No data")
      return json.data
    } catch {
      if (attempt === 2) return null
    }
  }
  return null
}

/** Timeframe duration in seconds (for computing candle boundaries) */
export const TIMEFRAME_SECONDS: Record<string, number> = {
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
