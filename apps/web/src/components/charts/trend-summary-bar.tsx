"use client"

import type { TrendData } from "@fxflow/types"
import { cn } from "@/lib/utils"

interface TrendSummaryBarProps {
  trendData: TrendData | null
  higherTfTrendData: TrendData | null
  isComputing: boolean
  className?: string
}

export function TrendSummaryBar({
  trendData,
  higherTfTrendData,
  isComputing,
  className,
}: TrendSummaryBarProps) {
  if (!trendData || trendData.swingPoints.length < 2) return null

  const { direction, status, controllingSwing, controllingSwingDistancePips, timeframe } = trendData

  const isTerminated = status === "terminated"
  const dirLabel = direction === "up" ? "Uptrend" : direction === "down" ? "Downtrend" : "Range"
  const dirColor =
    direction === "up"
      ? "text-blue-500"
      : direction === "down"
        ? "text-orange-500"
        : "text-muted-foreground"
  const dirBg =
    direction === "up" ? "bg-blue-500/10" : direction === "down" ? "bg-orange-500/10" : "bg-muted"
  const arrow = direction === "up" ? "\u25B2" : direction === "down" ? "\u25BC" : "\u25C6"

  return (
    <div
      className={cn(
        "bg-muted/50 flex items-center gap-3 rounded-md border px-2.5 py-1 text-[11px]",
        className,
      )}
      role="status"
      aria-label="Trend summary"
    >
      {/* Trend direction badge */}
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-semibold",
          dirBg,
          dirColor,
        )}
      >
        <span>{arrow}</span>
        <span>{dirLabel}</span>
        <span className="text-muted-foreground font-normal">({timeframe})</span>
        {isTerminated && <span className="ml-0.5 font-bold text-red-500">TERM</span>}
      </span>

      {/* Controlling swing level */}
      {controllingSwing && (
        <>
          <div className="bg-border h-3 w-px shrink-0" />
          <span className="flex shrink-0 items-center gap-1">
            <span className="text-muted-foreground">Ctrl:</span>
            <span className="font-medium tabular-nums">
              {controllingSwing.price.toFixed(controllingSwing.price < 10 ? 5 : 3)}
            </span>
            {controllingSwingDistancePips != null && (
              <span className="text-muted-foreground tabular-nums">
                ({controllingSwingDistancePips.toFixed(1)}p)
              </span>
            )}
          </span>
        </>
      )}

      {/* HTF trend (if available) */}
      {higherTfTrendData && higherTfTrendData.direction && (
        <>
          <div className="bg-border h-3 w-px shrink-0" />
          <span className="flex shrink-0 items-center gap-1">
            <span className="text-muted-foreground">HTF:</span>
            <span
              className={cn(
                "font-medium",
                higherTfTrendData.direction === "up" ? "text-blue-500" : "text-orange-500",
              )}
            >
              {higherTfTrendData.direction === "up" ? "\u25B2" : "\u25BC"}{" "}
              {higherTfTrendData.direction === "up" ? "Up" : "Down"}{" "}
              <span className="text-muted-foreground font-normal">
                ({higherTfTrendData.timeframe})
              </span>
            </span>
          </span>
        </>
      )}

      {/* Computing indicator */}
      {isComputing && (
        <>
          <div className="flex-1" />
          <span className="text-muted-foreground shrink-0 animate-pulse">Scanning...</span>
        </>
      )}
    </div>
  )
}
