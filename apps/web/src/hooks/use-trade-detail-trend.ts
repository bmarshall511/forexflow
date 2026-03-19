"use client"

import { useState, useEffect, useRef } from "react"
import type { ZoneCandle, TrendData } from "@fxflow/types"
import {
  detectTrend,
  DEFAULT_TREND_DETECTION_CONFIG,
  getDefaultSwingStrength,
} from "@fxflow/shared"
import { fetchCandles } from "@/components/charts/chart-utils"

/**
 * Trend detection for the trade detail drawer chart.
 *
 * Uses the same detectTrend algorithm and DEFAULT_TREND_DETECTION_CONFIG as the
 * charts page, ensuring identical trend structure rendering.
 *
 * Computes trend on the chart's active timeframe (not the MTF from the setup snapshot)
 * so swing points align with the loaded candle data and render correctly.
 */
export function useTradeDetailTrend(
  instrument: string | null,
  timeframe: string,
  currentPrice: number | null,
  enabled: boolean,
): TrendData | null {
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const computeIdRef = useRef(0)

  useEffect(() => {
    if (!enabled || !instrument) {
      setTrendData(null)
      return
    }

    const id = ++computeIdRef.current
    let cancelled = false

    // Use the same candle count as the default trend config (500)
    const count = DEFAULT_TREND_DETECTION_CONFIG.lookbackCandles
    fetchCandles(instrument, timeframe, count).then((candles) => {
      if (cancelled || id !== computeIdRef.current) return
      if (!candles || candles.length < 10) return

      const price = currentPrice ?? candles[candles.length - 1]?.close ?? 0

      // Use exact same config as the charts page with adaptive swing strength
      const config = {
        ...DEFAULT_TREND_DETECTION_CONFIG,
        swingStrength: getDefaultSwingStrength(timeframe),
      }

      const result = detectTrend(candles as ZoneCandle[], instrument, timeframe, config, price)
      if (id === computeIdRef.current) {
        setTrendData(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, [instrument, timeframe, enabled, currentPrice])

  return trendData
}
