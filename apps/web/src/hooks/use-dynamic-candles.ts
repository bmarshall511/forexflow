"use client"

import { useRef, useCallback, useState } from "react"
import type { IChartApi, ISeriesApi, CandlestickData, Time, LogicalRange } from "lightweight-charts"

interface CandleApiData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

/**
 * Manages dynamic candle loading — fetches older candles when the user scrolls
 * to the left edge of the chart.
 *
 * Call `setup(chart, series)` inside the chart init effect AFTER the chart is
 * created. This returns a cleanup function. The hook handles all internal state.
 */
export function useDynamicCandles(instrument: string, granularity: string) {
  const isLoadingRef = useRef(false)
  const noMoreDataRef = useRef(false)
  const allCandlesRef = useRef<CandleApiData[]>([])
  const [candleCount, setCandleCount] = useState(0)

  // Track instrument+granularity for reset
  const prevKeyRef = useRef(`${instrument}|${granularity}`)
  const currentKey = `${instrument}|${granularity}`
  if (prevKeyRef.current !== currentKey) {
    prevKeyRef.current = currentKey
    noMoreDataRef.current = false
    allCandlesRef.current = []
  }

  /** Seed with the initial candle load. */
  const setInitialData = useCallback((candles: CandleApiData[]) => {
    allCandlesRef.current = candles
    noMoreDataRef.current = false
    setCandleCount(candles.length)
  }, [])

  /**
   * Set up the visible-range subscription on the given chart + series.
   * MUST be called inside the chart init effect after createChart/addSeries.
   * Returns an unsubscribe function for cleanup.
   */
  const setup = useCallback(
    (chart: IChartApi, series: ISeriesApi<"Candlestick">) => {
      // Use local vars that close over stable refs — no stale closure issues
      const fetchOlder = async () => {
        if (isLoadingRef.current || noMoreDataRef.current) return
        if (!allCandlesRef.current.length) return

        isLoadingRef.current = true
        try {
          const earliest = allCandlesRef.current[0]
          if (!earliest) return

          const toDate = new Date(earliest.time * 1000).toISOString()
          const count = 200

          const res = await fetch(
            `/api/candles/${instrument}?granularity=${granularity}&count=${count}&to=${encodeURIComponent(toDate)}`,
          )
          if (!res.ok) return

          const json = (await res.json()) as { ok: boolean; data?: CandleApiData[] }
          if (!json.ok || !json.data || json.data.length === 0) {
            noMoreDataRef.current = true
            return
          }

          const existingTimes = new Set(allCandlesRef.current.map((c) => c.time))
          const newCandles = json.data.filter((c) => !existingTimes.has(c.time))

          if (newCandles.length === 0) {
            noMoreDataRef.current = true
            return
          }

          if (json.data.length < count * 0.5) {
            noMoreDataRef.current = true
          }

          const merged = [...newCandles, ...allCandlesRef.current].sort((a, b) => a.time - b.time)
          allCandlesRef.current = merged
          setCandleCount(merged.length)
          series.setData(merged as CandlestickData<Time>[])
        } finally {
          isLoadingRef.current = false
        }
      }

      const handleRangeChange = (logicalRange: LogicalRange | null) => {
        if (!logicalRange) return
        // When left edge is near the start of data, load more
        if (logicalRange.from < 10) {
          void fetchOlder()
        }
      }

      chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange)

      return () => {
        try {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange)
        } catch {
          // Chart may already be disposed
        }
      }
    },
    [instrument, granularity],
  )

  return { setInitialData, setup, candleCount }
}
