import { useEffect, useRef } from "react"
import type { ISeriesApi, IPriceLine, CandlestickData, Time } from "lightweight-charts"
import { LineStyle } from "lightweight-charts"
import type { PositionPriceTick } from "@fxflow/types"
import { TIMEFRAME_SECONDS } from "@/components/charts/chart-utils"

interface UseRealtimeCandlesOptions {
  /** Ref to the candlestick series (must be stable across renders) */
  seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>
  /** Instrument this chart displays (OANDA format, e.g. "EUR_USD") */
  instrument: string
  /** Current chart timeframe (e.g. "H1", "M15") */
  timeframe: string
  /** Full tick with bid, ask, and time from the WebSocket */
  lastTick: PositionPriceTick | null | undefined
  /** Fallback numeric price when lastTick is unavailable (no candle update, price line only) */
  fallbackPrice?: number | null
}

/**
 * Shared hook that keeps the chart's current candle and price line
 * in sync with live WebSocket ticks.
 *
 * - Updates or creates the blue "Price" price-line overlay
 * - Extends the last candle's OHLC with each tick (same period)
 * - Creates a new candle when a tick falls into the next period
 *
 * Returns a ref to the last candle so the chart init effect can seed it.
 */
export function useRealtimeCandles({
  seriesRef,
  instrument,
  timeframe,
  lastTick,
  fallbackPrice,
}: UseRealtimeCandlesOptions) {
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    // Derive mid price from tick, or fall back to numeric prop
    const mid =
      lastTick && lastTick.instrument === instrument
        ? (lastTick.bid + lastTick.ask) / 2
        : fallbackPrice
    if (mid == null) return

    // ── Price line ─────────────────────────────────────────────────────
    if (priceLineRef.current) {
      priceLineRef.current.applyOptions({ price: mid })
    } else {
      priceLineRef.current = series.createPriceLine({
        price: mid,
        color: "#3b82f6",
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        axisLabelVisible: true,
        title: "Price",
      })
    }

    // ── Candle update (requires tick with time) ────────────────────────
    if (!lastTick || lastTick.instrument !== instrument || !lastCandleRef.current) return
    const tickTime = Math.floor(new Date(lastTick.time).getTime() / 1000)
    const periodSeconds = TIMEFRAME_SECONDS[timeframe] ?? 3600
    const lastTime = lastCandleRef.current.time as number

    if (tickTime >= lastTime + periodSeconds) {
      // New candle period
      const newTime = (lastTime + periodSeconds) as Time
      const newCandle: CandlestickData<Time> = {
        time: newTime,
        open: mid,
        high: mid,
        low: mid,
        close: mid,
      }
      lastCandleRef.current = newCandle
      series.update(newCandle)
    } else {
      // Same period — update OHLC
      const candle = lastCandleRef.current
      candle.close = mid
      if (mid > candle.high) candle.high = mid
      if (mid < candle.low) candle.low = mid
      series.update({ ...candle })
    }
  }, [seriesRef, lastTick, fallbackPrice, instrument, timeframe])

  return { lastCandleRef, priceLineRef }
}
