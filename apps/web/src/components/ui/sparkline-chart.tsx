"use client"

import { useEffect, useRef, memo } from "react"
import { useTheme } from "next-themes"
import { createChart, AreaSeries } from "lightweight-charts"
import type { IChartApi, ISeriesApi, AreaData, Time } from "lightweight-charts"
import { cn } from "@/lib/utils"

export interface SparklineDataPoint {
  time: number
  value: number
}

interface SparklineChartProps {
  data: SparklineDataPoint[]
  /** Height in px (default 32) */
  height?: number
  /** Override line color */
  lineColor?: string
  /** Override gradient top color */
  areaTopColor?: string
  /** Override gradient bottom color */
  areaBottomColor?: string
  /** Force positive (green) or negative (red) coloring. undefined = auto-detect from first vs last value */
  positive?: boolean
  className?: string
}

const POSITIVE_LINE = "#22c55e"
const NEGATIVE_LINE = "#ef4444"

function SparklineChartInner({
  data,
  height = 32,
  lineColor,
  areaTopColor,
  areaBottomColor,
  positive,
  className,
}: SparklineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"

  // Determine trend direction
  const isPositive =
    positive !== undefined
      ? positive
      : data.length >= 2
        ? (data[data.length - 1]?.value ?? 0) >= (data[0]?.value ?? 0)
        : true

  const resolvedLineColor = lineColor ?? (isPositive ? POSITIVE_LINE : NEGATIVE_LINE)
  const resolvedAreaTop =
    areaTopColor ?? (isPositive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)")
  const resolvedAreaBottom =
    areaBottomColor ?? (isPositive ? "rgba(34,197,94,0.02)" : "rgba(239,68,68,0.02)")

  useEffect(() => {
    const container = containerRef.current
    if (!container || data.length < 2) return

    let disposed = false

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "transparent",
        fontSize: 1,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: 0, // disabled
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
    })
    chartRef.current = chart

    const series = chart.addSeries(AreaSeries, {
      lineColor: resolvedLineColor,
      topColor: resolvedAreaTop,
      bottomColor: resolvedAreaBottom,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    })
    seriesRef.current = series

    series.setData(data as AreaData<Time>[])
    chart.timeScale().fitContent()

    const observer = new ResizeObserver(() => {
      if (!disposed && container) {
        chart.applyOptions({ width: container.clientWidth })
      }
    })
    observer.observe(container)

    return () => {
      disposed = true
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, height])

  // Sync theme colors without recreating
  useEffect(() => {
    seriesRef.current?.applyOptions({
      lineColor: resolvedLineColor,
      topColor: resolvedAreaTop,
      bottomColor: resolvedAreaBottom,
    })
  }, [isDark, resolvedLineColor, resolvedAreaTop, resolvedAreaBottom])

  if (data.length < 2) {
    return (
      <div
        className={cn("flex items-center justify-center text-muted-foreground/30", className)}
        style={{ height }}
        aria-hidden="true"
      >
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M2 10 L8 6 L14 8 L22 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-hidden", className)}
      style={{ height }}
      aria-hidden="true"
      role="img"
      aria-label="Sparkline trend chart"
    />
  )
}

export const SparklineChart = memo(SparklineChartInner)
