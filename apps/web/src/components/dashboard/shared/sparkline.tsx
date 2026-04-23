"use client"

import { useMemo, useId } from "react"
import { cn } from "@/lib/utils"
import type { DashboardTone, SparkPoint } from "./types"

/**
 * Pure-SVG sparkline for MetricTile — intentionally lightweight (no recharts,
 * no lightweight-charts) so tiles don't each pull in a chart library. For
 * analytical charts that need tooltips/crosshairs/zoom, reach for the larger
 * recharts-based hero chart instead.
 *
 * Sizing: the SVG stretches to fill its container via `preserveAspectRatio`,
 * so the tile controls the visual footprint. Pass `height` for the canvas
 * height in px.
 */
const TONE_COLOR: Record<DashboardTone, string> = {
  positive: "var(--color-status-connected, #22c55e)",
  negative: "var(--color-status-disconnected, #ef4444)",
  neutral: "currentColor",
  warning: "var(--color-status-warning, #f59e0b)",
}

interface SparklineProps {
  data: SparkPoint[]
  /** Height in pixels. Width is always 100% of the parent. */
  height?: number
  /** Auto-detects from first vs last point when undefined. */
  tone?: DashboardTone
  /** ARIA label — describes the series for screen readers. */
  label?: string
  className?: string
}

export function Sparkline({ data, height = 32, tone, label, className }: SparklineProps) {
  const gradientId = useId()

  const { linePath, areaPath, resolvedTone } = useMemo(() => {
    if (data.length < 2) {
      return { linePath: "", areaPath: "", resolvedTone: tone ?? ("neutral" as DashboardTone) }
    }
    const ys = data.map((p) => p.y)
    const yMin = Math.min(...ys)
    const yMax = Math.max(...ys)
    const range = yMax - yMin || 1
    // ViewBox is 100 × 100 so we can keep units relative to tile shape.
    const n = data.length - 1
    const line = data
      .map((p, i) => {
        const x = (i / n) * 100
        const y = 100 - ((p.y - yMin) / range) * 100
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(" ")
    const area = `${line} L100,100 L0,100 Z`
    const first = data[0]!.y
    const last = data[data.length - 1]!.y
    const auto: DashboardTone = last > first ? "positive" : last < first ? "negative" : "neutral"
    return { linePath: line, areaPath: area, resolvedTone: tone ?? auto }
  }, [data, tone])

  if (data.length < 2) {
    return (
      <div
        className={cn("text-muted-foreground/30 flex items-center justify-center", className)}
        style={{ height }}
        aria-hidden="true"
      />
    )
  }

  const color = TONE_COLOR[resolvedTone]

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={!label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
