"use client"

import { useEffect, useRef, useState, useCallback, memo } from "react"
import { useTheme } from "next-themes"
import { createChart, CandlestickSeries, LineStyle, createSeriesMarkers } from "lightweight-charts"
import type { IChartApi, ISeriesApi, IPriceLine, ISeriesMarkersPluginApi, CandlestickData, Time, SeriesMarker } from "lightweight-charts"
import { cn } from "@/lib/utils"
import { getDecimalPlaces, TIMEFRAME_OPTIONS } from "@fxflow/shared"
import type { PositionPriceTick, ZoneData, CurveData, TrendData, TrendVisualSettings } from "@fxflow/types"
import { useDynamicCandles } from "@/hooks/use-dynamic-candles"
import { useRealtimeCandles } from "@/hooks/use-realtime-candles"
import { getChartOptions, getCandlestickOptions, fetchCandles } from "./chart-utils"
import { scrollToEntry } from "./chart-markers"
import { TradeLevelPrimitive } from "./trade-level-primitive"
import type { TradeLevel } from "./trade-level-primitive"
import { ZonePrimitive } from "./zone-primitive"
import { CurvePrimitive } from "./curve-primitive"
import { TrendPrimitive } from "./trend-primitive"

interface TradingViewChartProps {
  /** Instrument in OANDA format, e.g. "EUR_USD" */
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice?: number | null
  /** Full tick with time for real-time candle updates */
  lastTick?: PositionPriceTick | null
  stopLoss?: number | null
  takeProfit?: number | null
  exitPrice?: number | null
  /** Default timeframe from the trade's saved timeframe */
  defaultTimeframe?: string | null
  /** Signal markers (arrows) */
  markers?: SeriesMarker<Time>[]
  /** Trade entry/exit levels drawn as lines on the candles */
  tradeLevels?: TradeLevel[]
  /** Unix seconds to scroll/center the chart on after data loads */
  scrollToTime?: number
  /** Supply/demand zones to render */
  zones?: ZoneData[]
  /** Higher-timeframe zones rendered behind primary */
  higherTfZones?: ZoneData[]
  /** Current mid-price for zone nearest-highlight */
  zoneCurrentPrice?: number | null
  /** Curve overlay data */
  curveData?: CurveData | null
  /** Trend overlay data */
  trendData?: TrendData | null
  /** Higher-timeframe trend data */
  higherTfTrendData?: TrendData | null
  /** Trend visual settings */
  trendVisuals?: TrendVisualSettings
  /** Called when a zone rectangle is clicked */
  onZoneClick?: (zone: ZoneData) => void
  /** Chart height in px */
  height?: number
  className?: string
}

function TradingViewChartInner({
  instrument,
  direction,
  entryPrice,
  currentPrice,
  lastTick,
  stopLoss,
  takeProfit,
  exitPrice,
  defaultTimeframe,
  markers,
  tradeLevels,
  scrollToTime,
  zones,
  higherTfZones,
  zoneCurrentPrice,
  curveData,
  trendData,
  higherTfTrendData,
  trendVisuals,
  onZoneClick,
  height = 260,
  className,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const slLineRef = useRef<IPriceLine | null>(null)
  const tpLineRef = useRef<IPriceLine | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const tradeLevelPrimRef = useRef<TradeLevelPrimitive | null>(null)
  const zonePrimRef = useRef<ZonePrimitive | null>(null)
  const curvePrimRef = useRef<CurvePrimitive | null>(null)
  const trendPrimRef = useRef<TrendPrimitive | null>(null)
  const scrollToTimeRef = useRef(scrollToTime)
  scrollToTimeRef.current = scrollToTime
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)
  const [granularity, setGranularity] = useState(defaultTimeframe ?? "H1")

  // Sync granularity when defaultTimeframe arrives from async API
  useEffect(() => {
    if (defaultTimeframe) setGranularity(defaultTimeframe)
  }, [defaultTimeframe])

  const isDark = resolvedTheme !== "light"
  const decimals = getDecimalPlaces(instrument)
  const minMove = decimals === 3 ? 0.001 : 0.00001

  // Dynamic candle loading on scroll/zoom
  const { setInitialData, setup: setupDynamic } = useDynamicCandles(instrument, granularity)

  // Shared real-time candle + price line hook
  const { lastCandleRef, priceLineRef } = useRealtimeCandles({
    seriesRef,
    instrument,
    timeframe: granularity,
    lastTick,
    fallbackPrice: currentPrice,
  })

  // Fetch candle data
  const loadCandles = useCallback(
    async (tf: string) => {
      const candles = await fetchCandles(instrument, tf)
      if (!candles) setError("Failed to load chart data")
      return candles
    },
    [instrument],
  )

  // Initialize chart + load data
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false

    const chart = createChart(container, {
      ...getChartOptions(isDark, height),
      width: container.clientWidth,
    })

    chartRef.current = chart

    const series = chart.addSeries(CandlestickSeries, getCandlestickOptions(isDark, decimals, minMove))
    seriesRef.current = series

    // Add price lines (SL, TP, Exit — entry is shown by the trade-level primitive)
    if (stopLoss != null) {
      slLineRef.current = series.createPriceLine({
        price: stopLoss,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "SL",
      })
    }

    if (takeProfit != null) {
      tpLineRef.current = series.createPriceLine({
        price: takeProfit,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "TP",
      })
    }

    // Attach trade-level primitive (draws entry/exit lines on candles)
    const tradeLevelPrim = new TradeLevelPrimitive()
    series.attachPrimitive(tradeLevelPrim)
    tradeLevelPrimRef.current = tradeLevelPrim

    // Attach zone rendering primitive
    const zonePrim = new ZonePrimitive()
    series.attachPrimitive(zonePrim)
    zonePrimRef.current = zonePrim

    // Attach curve rendering primitive
    const curvePrim = new CurvePrimitive()
    series.attachPrimitive(curvePrim)
    curvePrimRef.current = curvePrim

    // Attach trend rendering primitive
    const trendPrim = new TrendPrimitive()
    series.attachPrimitive(trendPrim)
    trendPrimRef.current = trendPrim

    // Subscribe to visible range changes for dynamic candle loading
    const unsubDynamic = setupDynamic(chart, series)

    // Load candle data
    loadCandles(granularity).then((candles) => {
      if (disposed || !candles || candles.length === 0) return
      series.setData(candles as CandlestickData<Time>[])
      setInitialData(candles)
      const last = candles[candles.length - 1]
      if (last) {
        lastCandleRef.current = {
          time: last.time as Time,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
        }
      }
      // Auto-scroll to entry candle or fit all content
      if (scrollToTimeRef.current != null) {
        scrollToEntry(chart, scrollToTimeRef.current, granularity)
      } else {
        chart.timeScale().fitContent()
      }
    })

    // Handle resize
    const handleResize = () => {
      if (container && !disposed) {
        chart.applyOptions({ width: container.clientWidth })
      }
    }
    const observer = new ResizeObserver(handleResize)
    observer.observe(container)

    return () => {
      disposed = true
      unsubDynamic()
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      lastCandleRef.current = null
      priceLineRef.current = null
      slLineRef.current = null
      tpLineRef.current = null
      markersRef.current = null
      tradeLevelPrimRef.current = null
      zonePrimRef.current = null
      curvePrimRef.current = null
      trendPrimRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, height, entryPrice, stopLoss, takeProfit, granularity, decimals, minMove, loadCandles, setInitialData, setupDynamic])

  // Update theme without recreating the chart
  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    chart.applyOptions(getChartOptions(isDark, height))
    series.applyOptions(getCandlestickOptions(isDark, decimals, minMove))
  }, [isDark, height, decimals, minMove])

  // ─── Signal markers (arrows) ──────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    if (markers && markers.length > 0) {
      if (markersRef.current) {
        markersRef.current.setMarkers(markers)
      } else {
        markersRef.current = createSeriesMarkers(series, markers)
      }
    } else if (markersRef.current) {
      markersRef.current.setMarkers([])
    }
  }, [markers])

  // ─── Trade level indicators (lines on candles via primitive) ──────────
  useEffect(() => {
    if (tradeLevelPrimRef.current) {
      tradeLevelPrimRef.current.setLevels(tradeLevels ?? [])
    }
  }, [tradeLevels])

  // ─── Zone overlay: sync zones into the primitive ─────────────────────
  const lastZonePriceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!zonePrimRef.current) return
    const price = zoneCurrentPrice ?? lastZonePriceRef.current
    if (zones && zones.length > 0 && price != null) {
      lastZonePriceRef.current = price
      zonePrimRef.current.setZones(zones, price, isDark, decimals)
    } else if (!zones || zones.length === 0) {
      zonePrimRef.current.clearAll()
    }
  }, [zones, zoneCurrentPrice, isDark, decimals])

  useEffect(() => {
    if (!zonePrimRef.current) return
    zonePrimRef.current.setHigherTfZones(higherTfZones ?? [])
  }, [higherTfZones])

  // ─── Curve overlay: sync curve data into the primitive ──────────────────
  useEffect(() => {
    if (!curvePrimRef.current) return
    if (curveData) {
      curvePrimRef.current.setCurve(curveData, isDark)
    } else {
      curvePrimRef.current.clearCurve()
    }
  }, [curveData, isDark])

  // ─── Trend overlay: sync trend data into the primitive ─────────────────
  useEffect(() => {
    if (!trendPrimRef.current) return
    if (trendData && trendVisuals) {
      trendPrimRef.current.setTrend(trendData, trendVisuals, isDark)
    } else {
      trendPrimRef.current.clearTrend()
    }
  }, [trendData, trendVisuals, isDark])

  useEffect(() => {
    if (!trendPrimRef.current) return
    trendPrimRef.current.setHigherTfTrend(higherTfTrendData ?? null)
  }, [higherTfTrendData])

  // ─── Zone click detection ──────────────────────────────────────────────
  const onZoneClickRef = useRef(onZoneClick)
  onZoneClickRef.current = onZoneClick

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const prim = zonePrimRef.current
      if (!prim || !onZoneClickRef.current) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const hit = prim.hitTest(x, y)
      if (hit) {
        const allZones = [...(zones ?? []), ...(higherTfZones ?? [])]
        const zone = allZones.find((z) => z.id === hit.externalId)
        if (zone) onZoneClickRef.current(zone)
      }
    }

    container.addEventListener("click", handleClick)
    return () => container.removeEventListener("click", handleClick)
  }, [zones, higherTfZones])

  return (
    <div className={cn("w-full rounded-md overflow-hidden relative", className)}>
      {/* Timeframe selector pills */}
      <div className="flex items-center gap-1 px-1 pb-1.5" role="radiogroup" aria-label="Chart timeframe">
        {TIMEFRAME_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={granularity === value}
            onClick={() => setGranularity(value)}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
              granularity === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div ref={containerRef} style={{ height }} />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}
    </div>
  )
}

export const TradingViewChart = memo(TradingViewChartInner)
