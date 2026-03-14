"use client"

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react"
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
import type {
  PositionPriceTick,
  TradeDirection,
  PlaceableOrderType,
  ZoneData,
  CurveData,
  TrendData,
  TrendVisualSettings,
} from "@fxflow/types"
import { getDecimalPlaces } from "@fxflow/shared"
import { ZonePrimitive } from "./zone-primitive"
import { CurvePrimitive } from "./curve-primitive"
import { TrendPrimitive } from "./trend-primitive"
import { useDynamicCandles } from "@/hooks/use-dynamic-candles"
import { useRealtimeCandles } from "@/hooks/use-realtime-candles"
import { usePriceLineDrag } from "@/hooks/use-price-line-drag"
import type { LineType } from "@/hooks/use-price-line-drag"
import { getChartOptions, getCandlestickOptions, fetchCandles } from "./chart-utils"

export interface OrderOverlayConfig {
  direction: TradeDirection
  orderType: PlaceableOrderType
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  onDraftChange: (lineType: LineType, price: number) => void
}

interface StandaloneChartProps {
  instrument: string
  timeframe: string
  lastTick: PositionPriceTick | null
  /** Stagger initial load to avoid concurrent API calls (ms) */
  loadDelay?: number
  /** Order overlay lines (entry/SL/TP) for order placement */
  orderOverlay?: OrderOverlayConfig | null
  /** Markers (signal arrows, trade entry/exit arrows) */
  markers?: SeriesMarker<Time>[]
  /** Supply/demand zones to render */
  zones?: ZoneData[]
  /** Higher-timeframe zones rendered behind primary */
  higherTfZones?: ZoneData[]
  /** Current mid-price for zone nearest-highlight */
  currentPrice?: number | null
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
  /** Called when the loaded candle count changes (initial load + dynamic scroll) */
  onCandleCountChange?: (count: number) => void
  className?: string
}

function StandaloneChartInner({
  instrument,
  timeframe,
  lastTick,
  loadDelay = 0,
  orderOverlay,
  markers,
  zones,
  higherTfZones,
  currentPrice,
  curveData,
  trendData,
  higherTfTrendData,
  trendVisuals,
  onZoneClick,
  onCandleCountChange,
  className,
}: StandaloneChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const entryLineRef = useRef<IPriceLine | null>(null)
  const slLineRef = useRef<IPriceLine | null>(null)
  const tpLineRef = useRef<IPriceLine | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const zonePrimRef = useRef<ZonePrimitive | null>(null)
  const curvePrimRef = useRef<CurvePrimitive | null>(null)
  const trendPrimRef = useRef<TrendPrimitive | null>(null)
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)

  const isDark = resolvedTheme !== "light"
  const decimals = getDecimalPlaces(instrument)
  const minMove = decimals === 3 ? 0.001 : 0.00001

  const {
    setInitialData,
    setup: setupDynamic,
    candleCount,
  } = useDynamicCandles(instrument, timeframe)

  // Notify parent when candle count changes (initial load + dynamic scroll)
  const onCandleCountChangeRef = useRef(onCandleCountChange)
  onCandleCountChangeRef.current = onCandleCountChange
  useEffect(() => {
    onCandleCountChangeRef.current?.(candleCount)
  }, [candleCount])

  // Shared real-time candle + price line hook
  const { lastCandleRef, priceLineRef } = useRealtimeCandles({
    seriesRef,
    instrument,
    timeframe,
    lastTick,
  })

  const loadCandles = useCallback(
    async (tf: string) => {
      setError(null)
      const candles = await fetchCandles(instrument, tf)
      if (!candles) setError("Failed to load chart data")
      return candles
    },
    [instrument],
  )

  // Initialize chart
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false

    const chart = createChart(container, {
      ...getChartOptions(isDark, container.clientHeight),
      width: container.clientWidth,
    })
    chartRef.current = chart

    const series = chart.addSeries(
      CandlestickSeries,
      getCandlestickOptions(isDark, decimals, minMove),
    )
    seriesRef.current = series

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
    // Must happen AFTER chart+series are created to avoid timing issues
    const unsubDynamic = setupDynamic(chart, series)

    const load = () => {
      loadCandles(timeframe).then((candles) => {
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
        chart.timeScale().fitContent()
      })
    }

    // Stagger initial load to avoid concurrent API calls
    let delayTimer: ReturnType<typeof setTimeout> | null = null
    if (loadDelay > 0) {
      delayTimer = setTimeout(() => {
        if (!disposed) load()
      }, loadDelay)
    } else {
      load()
    }

    const handleResize = () => {
      if (container && !disposed) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        })
      }
    }
    const observer = new ResizeObserver(handleResize)
    observer.observe(container)

    return () => {
      disposed = true
      if (delayTimer) clearTimeout(delayTimer)
      unsubDynamic()
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      lastCandleRef.current = null // reset hook's ref on chart dispose
      priceLineRef.current = null
      entryLineRef.current = null
      slLineRef.current = null
      tpLineRef.current = null
      markersRef.current = null
      zonePrimRef.current = null
      curvePrimRef.current = null
      trendPrimRef.current = null
    }
    // loadDelay is stable per-panel so won't cause re-mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, timeframe, decimals, minMove, loadCandles, setInitialData, setupDynamic])

  // Update theme without recreating the chart (preserves all price line refs)
  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    chart.applyOptions(getChartOptions(isDark, containerRef.current?.clientHeight ?? 400))
    series.applyOptions(getCandlestickOptions(isDark, decimals, minMove))
  }, [isDark, decimals, minMove])

  // ─── Order overlay: sync entry line ──────────────────────────────────────
  const overlayEntry = orderOverlay?.entryPrice ?? null
  const overlayIsLimit = orderOverlay?.orderType === "LIMIT"

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    if (overlayIsLimit && overlayEntry != null) {
      if (entryLineRef.current) {
        entryLineRef.current.applyOptions({ price: overlayEntry })
      } else {
        entryLineRef.current = series.createPriceLine({
          price: overlayEntry,
          color: "#f59e0b",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Entry",
        })
      }
    } else if (entryLineRef.current) {
      series.removePriceLine(entryLineRef.current)
      entryLineRef.current = null
    }
  }, [overlayEntry, overlayIsLimit])

  // ─── Order overlay: sync SL line ─────────────────────────────────────────
  const overlaySL = orderOverlay?.stopLoss ?? null

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    if (overlaySL != null) {
      if (slLineRef.current) {
        slLineRef.current.applyOptions({ price: overlaySL })
      } else {
        slLineRef.current = series.createPriceLine({
          price: overlaySL,
          color: "#ef4444",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "SL",
        })
      }
    } else if (slLineRef.current) {
      series.removePriceLine(slLineRef.current)
      slLineRef.current = null
    }
  }, [overlaySL])

  // ─── Order overlay: sync TP line ─────────────────────────────────────────
  const overlayTP = orderOverlay?.takeProfit ?? null

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    if (overlayTP != null) {
      if (tpLineRef.current) {
        tpLineRef.current.applyOptions({ price: overlayTP })
      } else {
        tpLineRef.current = series.createPriceLine({
          price: overlayTP,
          color: "#22c55e",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "TP",
        })
      }
    } else if (tpLineRef.current) {
      series.removePriceLine(tpLineRef.current)
      tpLineRef.current = null
    }
  }, [overlayTP])

  // ─── Order overlay: clean up lines when overlay is removed ───────────────
  useEffect(() => {
    if (orderOverlay) return
    const series = seriesRef.current
    if (!series) return

    if (entryLineRef.current) {
      series.removePriceLine(entryLineRef.current)
      entryLineRef.current = null
    }
    if (slLineRef.current) {
      series.removePriceLine(slLineRef.current)
      slLineRef.current = null
    }
    if (tpLineRef.current) {
      series.removePriceLine(tpLineRef.current)
      tpLineRef.current = null
    }
  }, [orderOverlay])

  // ─── Markers (signal arrows, trade entry/exit arrows) ──────────────────
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

  // ─── Zone overlay: sync zones into the primitive ─────────────────────────
  // Use last known price to avoid clearing zones when price is transiently null
  const lastZonePriceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!zonePrimRef.current) return
    const price = currentPrice ?? lastZonePriceRef.current
    if (zones && zones.length > 0 && price != null) {
      lastZonePriceRef.current = price
      zonePrimRef.current.setZones(zones, price, isDark, decimals)
    } else if (!zones || zones.length === 0) {
      zonePrimRef.current.clearAll()
    }
  }, [zones, currentPrice, isDark, decimals])

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

  // ─── Order overlay: drag interaction ─────────────────────────────────────
  const noopDraftChange = useCallback(() => {}, [])
  const dragLines = useMemo(
    () => ({
      entry: overlayIsLimit ? entryLineRef.current : null,
      sl: slLineRef.current,
      tp: tpLineRef.current,
    }),
    [overlayIsLimit, overlayEntry, overlaySL, overlayTP],
  )
  const { isDragging } = usePriceLineDrag({
    containerRef,
    seriesRef,
    chartRef,
    lines: dragLines,
    instrument,
    enabled: !!orderOverlay,
    onDraftChange: orderOverlay?.onDraftChange ?? noopDraftChange,
  })

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ touchAction: isDragging ? "none" : undefined }}
      />
      {error && (
        <div className="bg-muted/50 absolute inset-0 flex items-center justify-center">
          <p className="text-muted-foreground text-xs">{error}</p>
        </div>
      )}
    </div>
  )
}

export const StandaloneChart = memo(StandaloneChartInner)
