"use client"

import { useState, useEffect, useRef } from "react"
import type { ZoneCandle, TrendData } from "@fxflow/types"
import { detectTrend, getDefaultSwingStrength } from "@fxflow/shared"
import { fetchCandles } from "@/components/charts/chart-utils"

/**
 * Lightweight trend detection for the trade detail drawer chart.
 *
 * Computes trend on the chart's active timeframe (not the MTF from the setup snapshot)
 * so swing points align with the loaded candle data and render correctly.
 *
 * This is simpler than useTrends (no settings/persistence) — just fetch + detect.
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
    if (!enabled || !instrument || !currentPrice) {
      setTrendData(null)
      return
    }

    const id = ++computeIdRef.current
    let cancelled = false

    fetchCandles(instrument, timeframe, 300).then((candles) => {
      if (cancelled || id !== computeIdRef.current) return
      if (!candles || candles.length < 10) return

      const price = currentPrice ?? candles[candles.length - 1]?.close ?? 0
      const result = detectTrend(
        candles as ZoneCandle[],
        instrument,
        timeframe,
        {
          swingStrength: getDefaultSwingStrength(timeframe),
          minSegmentAtr: 0.5,
          maxSwingPoints: 20,
          lookbackCandles: 300,
        },
        price,
      )
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
