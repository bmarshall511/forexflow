"use client"

import { useEffect, useRef, useMemo } from "react"
import { useTheme } from "next-themes"
import { createChart, CandlestickSeries } from "lightweight-charts"
import type { IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts"
import { getDecimalPlaces } from "@fxflow/shared"
import { getChartOptions, getCandlestickOptions } from "@/components/charts/chart-utils"
import type { ReplayCandle, ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"
import { createOverlayLines, updateOverlayLines, type OverlayLines } from "./replay-overlay-lines"

interface TradeReplayProps {
  candles: ReplayCandle[]
  tradeInfo: ReplayTradeInfo
  currentIndex: number
  height?: number
}

export function TradeReplay({ candles, tradeInfo, currentIndex, height = 320 }: TradeReplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const overlayRef = useRef<OverlayLines | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"

  const instrument = tradeInfo.instrument
  const decimals = getDecimalPlaces(instrument)
  const minMove = decimals === 3 ? 0.001 : 0.00001

  // Find entry/exit candle indices
  const entryTime = useMemo(
    () => Math.floor(new Date(tradeInfo.openedAt).getTime() / 1000),
    [tradeInfo.openedAt],
  )
  const exitTime = useMemo(
    () => (tradeInfo.closedAt ? Math.floor(new Date(tradeInfo.closedAt).getTime() / 1000) : null),
    [tradeInfo.closedAt],
  )

  const entryCandleIdx = useMemo(
    () => candles.findIndex((c) => c.time >= entryTime),
    [candles, entryTime],
  )
  const exitCandleIdx = useMemo(
    () => (exitTime !== null ? candles.findIndex((c) => c.time >= exitTime) : -1),
    [candles, exitTime],
  )

  // Create chart once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      ...getChartOptions(isDark, height),
      width: container.clientWidth,
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true },
    })
    chartRef.current = chart

    const series = chart.addSeries(
      CandlestickSeries,
      getCandlestickOptions(isDark, decimals, minMove),
    )
    seriesRef.current = series
    overlayRef.current = createOverlayLines(chart, tradeInfo)

    const observer = new ResizeObserver(() => {
      if (container) chart.applyOptions({ width: container.clientWidth })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      overlayRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, isDark, height, decimals, minMove])

  // Update visible candles when currentIndex changes (progressive reveal)
  useEffect(() => {
    const series = seriesRef.current
    const overlay = overlayRef.current
    if (!series || !overlay || candles.length === 0) return

    series.setData(candles.slice(0, currentIndex + 1) as CandlestickData<Time>[])
    updateOverlayLines(overlay, candles, tradeInfo, currentIndex, entryCandleIdx, exitCandleIdx)
  }, [candles, currentIndex, tradeInfo, entryCandleIdx, exitCandleIdx])

  return <div ref={containerRef} className="h-full w-full" style={{ height }} />
}
