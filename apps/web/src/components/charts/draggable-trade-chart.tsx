"use client"

import { useEffect, useRef, useState, useCallback, memo } from "react"
import { useTheme } from "next-themes"
import { createChart, CandlestickSeries, LineStyle, createSeriesMarkers } from "lightweight-charts"
import type {
  IChartApi,
  ISeriesApi,
  IPriceLine,
  ISeriesMarkersPluginApi,
  CandlestickData,
  Time,
  SeriesMarker,
} from "lightweight-charts"
import { cn } from "@/lib/utils"
import { getDecimalPlaces, TIMEFRAME_OPTIONS } from "@fxflow/shared"
import type {
  PositionPriceTick,
  ZoneData,
  CurveData,
  TrendData,
  TrendVisualSettings,
} from "@fxflow/types"
import { usePriceLineDrag } from "@/hooks/use-price-line-drag"
import type { LineType } from "@/hooks/use-price-line-drag"
import { useDynamicCandles } from "@/hooks/use-dynamic-candles"
import { useRealtimeCandles } from "@/hooks/use-realtime-candles"
import { getChartOptions, getCandlestickOptions, fetchCandles } from "./chart-utils"
import { scrollToEntry } from "./chart-markers"
import { TradeLevelPrimitive } from "./trade-level-primitive"
import type { TradeLevel } from "./trade-level-primitive"
import { ZonePrimitive } from "./zone-primitive"
import { CurvePrimitive } from "./curve-primitive"
import { TrendPrimitive } from "./trend-primitive"

interface DraggableTradeChartProps {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice: number | null
  /** Full tick with time for real-time candle updates */
  lastTick?: PositionPriceTick | null
  draftSL: number | null
  draftTP: number | null
  savedSL: number | null
  savedTP: number | null
  defaultTimeframe?: string | null
  onDraftChange: (lineType: LineType, price: number) => void
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
  height?: number
  className?: string
}

function DraggableTradeChartInner({
  instrument,
  entryPrice,
  currentPrice,
  lastTick,
  draftSL,
  draftTP,
  savedSL,
  savedTP,
  defaultTimeframe,
  onDraftChange,
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
  height,
  className,
}: DraggableTradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const entryLineRef = useRef<IPriceLine | null>(null)
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

  // Determine if SL/TP are unsaved (draft differs from saved)
  const isSLDraft =
    draftSL !== null &&
    (savedSL === null || draftSL.toFixed(decimals) !== savedSL.toFixed(decimals))
  const isTPDraft =
    draftTP !== null &&
    (savedTP === null || draftTP.toFixed(decimals) !== savedTP.toFixed(decimals))

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

    const chartHeight = height ?? container.clientHeight
    const chart = createChart(container, {
      ...getChartOptions(isDark, chartHeight),
      width: container.clientWidth,
    })

    chartRef.current = chart

    const series = chart.addSeries(
      CandlestickSeries,
      getCandlestickOptions(isDark, decimals, minMove),
    )
    seriesRef.current = series

    // SL line
    if (draftSL != null) {
      slLineRef.current = series.createPriceLine({
        price: draftSL,
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: isSLDraft ? LineStyle.Dashed : LineStyle.Dashed,
        axisLabelVisible: true,
        title: "SL",
      })
    }

    // TP line
    if (draftTP != null) {
      tpLineRef.current = series.createPriceLine({
        price: draftTP,
        color: "#22c55e",
        lineWidth: 2,
        lineStyle: isTPDraft ? LineStyle.Dashed : LineStyle.Dashed,
        axisLabelVisible: true,
        title: "TP",
      })
    }

    // Entry price line (dotted, subtle)
    entryLineRef.current = series.createPriceLine({
      price: entryPrice,
      color: isDark ? "#94a3b8" : "#64748b",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: "Entry",
    })

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
      entryLineRef.current = null
      slLineRef.current = null
      tpLineRef.current = null
      markersRef.current = null
      tradeLevelPrimRef.current = null
      zonePrimRef.current = null
      curvePrimRef.current = null
      trendPrimRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    instrument,
    height,
    entryPrice,
    granularity,
    decimals,
    minMove,
    loadCandles,
    setInitialData,
    setupDynamic,
  ])

  // Update theme without recreating the chart (preserves all price line refs)
  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    chart.applyOptions(getChartOptions(isDark, height ?? containerRef.current?.clientHeight ?? 400))
    series.applyOptions(getCandlestickOptions(isDark, decimals, minMove))
    if (entryLineRef.current) {
      entryLineRef.current.applyOptions({ color: isDark ? "#94a3b8" : "#64748b" })
    }
  }, [isDark, height, decimals, minMove])

  // Sync draft price line positions when draft values change externally (from form input)
  useEffect(() => {
    if (slLineRef.current && draftSL != null) {
      slLineRef.current.applyOptions({ price: draftSL })
    }
    if (!slLineRef.current && draftSL != null && seriesRef.current) {
      slLineRef.current = seriesRef.current.createPriceLine({
        price: draftSL,
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "SL",
      })
    }
    if (slLineRef.current && draftSL == null && seriesRef.current) {
      seriesRef.current.removePriceLine(slLineRef.current)
      slLineRef.current = null
    }
  }, [draftSL])

  useEffect(() => {
    if (tpLineRef.current && draftTP != null) {
      tpLineRef.current.applyOptions({ price: draftTP })
    }
    if (!tpLineRef.current && draftTP != null && seriesRef.current) {
      tpLineRef.current = seriesRef.current.createPriceLine({
        price: draftTP,
        color: "#22c55e",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "TP",
      })
    }
    if (tpLineRef.current && draftTP == null && seriesRef.current) {
      seriesRef.current.removePriceLine(tpLineRef.current)
      tpLineRef.current = null
    }
  }, [draftTP])

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

  // Drag interaction
  const { isDragging } = usePriceLineDrag({
    containerRef,
    seriesRef,
    chartRef,
    lines: { sl: slLineRef.current, tp: tpLineRef.current },
    instrument,
    onDraftChange,
  })

  return (
    <div className={cn("relative flex w-full flex-col overflow-hidden rounded-md", className)}>
      {/* Timeframe selector pills */}
      <div
        className="flex shrink-0 items-center gap-1 px-1 pb-1.5"
        role="radiogroup"
        aria-label="Chart timeframe"
      >
        {TIMEFRAME_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={granularity === value}
            onClick={() => setGranularity(value)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              granularity === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="min-h-0 flex-1"
        style={{
          height: height !== undefined ? height : undefined,
          touchAction: isDragging ? "none" : undefined,
        }}
      />
      {error && (
        <div className="bg-muted/50 absolute inset-0 flex items-center justify-center rounded-md">
          <p className="text-muted-foreground text-xs">{error}</p>
        </div>
      )}
    </div>
  )
}

export const DraggableTradeChart = memo(DraggableTradeChartInner)
