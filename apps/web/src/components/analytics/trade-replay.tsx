"use client"

import { useEffect, useRef, useMemo } from "react"
import { useTheme } from "next-themes"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
} from "lightweight-charts"
import type {
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  CandlestickData,
  Time,
} from "lightweight-charts"
import { getDecimalPlaces } from "@fxflow/shared"
import type { TradeFinderSetupData, TrendVisualSettings } from "@fxflow/types"
import { getChartOptions, getCandlestickOptions } from "@/components/charts/chart-utils"
import { ZonePrimitive } from "@/components/charts/zone-primitive"
import { CurvePrimitive } from "@/components/charts/curve-primitive"
import { TrendPrimitive } from "@/components/charts/trend-primitive"
import type { ReplayCandle, ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"
import {
  createOverlayLines,
  updateOverlayLines,
  getReplayMarkers,
  type OverlayLines,
} from "./replay-overlay-lines"
import type { OverlayVisibility } from "./replay-overlay-legend"

const REPLAY_TREND_VISUALS: TrendVisualSettings = {
  showBoxes: false,
  showLines: true,
  showMarkers: true,
  showLabels: true,
  showControllingSwing: true,
  boxOpacity: 0.1,
}

interface TradeReplayProps {
  candles: ReplayCandle[]
  tradeInfo: ReplayTradeInfo
  currentIndex: number
  /** Trade Finder setup snapshot (zones, trend, curve) */
  tfSetup?: TradeFinderSetupData | null
  /** Controls which overlay lines are rendered */
  overlayVisibility?: OverlayVisibility
  /**
   * Fixed pixel height. Pass 0 to have the component fill its flex container
   * (the container must have a defined height from the parent).
   */
  height?: number
}

export function TradeReplay({
  candles,
  tradeInfo,
  currentIndex,
  tfSetup,
  overlayVisibility,
  height = 320,
}: TradeReplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const overlayRef = useRef<OverlayLines | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const zonePrimRef = useRef<ZonePrimitive | null>(null)
  const curvePrimRef = useRef<CurvePrimitive | null>(null)
  const trendPrimRef = useRef<TrendPrimitive | null>(null)
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

  // Create chart once — recreate when theme/decimals/height change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // When height === 0, use the container's flex-driven height
    const chartHeight = height === 0 ? container.offsetHeight || 400 : height

    const chart = createChart(container, {
      ...getChartOptions(isDark, chartHeight),
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

    // Volume histogram — rendered in the bottom 15% of the chart pane
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    volumeSeriesRef.current = volumeSeries

    overlayRef.current = createOverlayLines(chart, tradeInfo)

    // Attach primitives for Trade Finder overlays
    const zonePrim = new ZonePrimitive()
    series.attachPrimitive(zonePrim)
    zonePrimRef.current = zonePrim

    const curvePrim = new CurvePrimitive()
    series.attachPrimitive(curvePrim)
    curvePrimRef.current = curvePrim

    const trendPrim = new TrendPrimitive()
    series.attachPrimitive(trendPrim)
    trendPrimRef.current = trendPrim

    const observer = new ResizeObserver(() => {
      if (!container) return
      const w = container.clientWidth
      const h = height === 0 ? container.offsetHeight : height
      chart.applyOptions({ width: w, height: h || undefined })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      overlayRef.current = null
      markersRef.current = null
      zonePrimRef.current = null
      curvePrimRef.current = null
      trendPrimRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, isDark, height, decimals, minMove])

  // Update visible candles + overlay lines + markers when playback position changes
  useEffect(() => {
    const series = seriesRef.current
    const overlay = overlayRef.current
    if (!series || !overlay || candles.length === 0) return

    const visibleCandles = candles.slice(0, currentIndex + 1)
    series.setData(visibleCandles as unknown as CandlestickData<Time>[])

    // Update volume bars
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        visibleCandles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color:
            c.close >= c.open
              ? isDark
                ? "rgba(34, 197, 94, 0.3)"
                : "rgba(34, 197, 94, 0.2)"
              : isDark
                ? "rgba(239, 68, 68, 0.3)"
                : "rgba(239, 68, 68, 0.2)",
        })),
      )
    }
    updateOverlayLines(
      overlay,
      candles,
      tradeInfo,
      currentIndex,
      entryCandleIdx,
      exitCandleIdx,
      overlayVisibility,
    )

    const markers = getReplayMarkers(
      candles,
      tradeInfo,
      currentIndex,
      entryCandleIdx,
      exitCandleIdx,
    )
    if (markersRef.current) {
      markersRef.current.setMarkers(markers)
    } else if (markers.length > 0) {
      markersRef.current = createSeriesMarkers(series, markers)
    }
  }, [candles, currentIndex, tradeInfo, entryCandleIdx, exitCandleIdx, overlayVisibility, isDark])

  // Sync Trade Finder zone/trend/curve overlays
  useEffect(() => {
    if (!zonePrimRef.current) return
    if (tfSetup) {
      zonePrimRef.current.setZones([tfSetup.zone], tfSetup.entryPrice, isDark, decimals)
    } else {
      zonePrimRef.current.clearAll()
    }
  }, [tfSetup, isDark, decimals])

  useEffect(() => {
    if (!curvePrimRef.current) return
    if (tfSetup?.curveData) {
      curvePrimRef.current.setCurve(tfSetup.curveData, isDark)
    } else {
      curvePrimRef.current.clearCurve()
    }
  }, [tfSetup, isDark])

  useEffect(() => {
    if (!trendPrimRef.current) return
    if (tfSetup?.trendData) {
      trendPrimRef.current.setTrend(tfSetup.trendData, REPLAY_TREND_VISUALS, isDark)
    } else {
      trendPrimRef.current.clearTrend()
    }
  }, [tfSetup, isDark])

  return (
    <div
      ref={containerRef}
      data-replay-chart
      className="h-full w-full"
      style={height !== 0 ? { height } : undefined}
    />
  )
}
