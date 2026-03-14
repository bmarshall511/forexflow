"use client"

import { calculateDistanceInfo, formatPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface PendingProgressBarProps {
  instrument: string
  entryPrice: number
  currentPrice: number | null
  className?: string
}

export function PendingProgressBar({
  instrument,
  entryPrice,
  currentPrice,
  className,
}: PendingProgressBarProps) {
  if (!currentPrice) {
    return <div className={cn("bg-muted h-2 rounded-full", className)} />
  }

  const info = calculateDistanceInfo(instrument, currentPrice, entryPrice)
  // Cap at 100% for display; closer = higher fill
  const maxPips = Math.max(info.pips * 2, 20) // Scale relative to distance
  const fillPercent = Math.min(100, Math.max(0, ((maxPips - info.pips) / maxPips) * 100))
  const isClose = fillPercent > 70

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(fillPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${formatPips(info.pips)} from fill`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isClose ? "bg-status-warning" : "bg-status-connecting",
          )}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <span className="text-muted-foreground text-[10px] tabular-nums">
        {formatPips(info.pips)} ({info.percentage.toFixed(2)}%)
      </span>
    </div>
  )
}
