"use client"

import { calculateDistanceInfo, formatPips, priceToPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface PendingProgressBarProps {
  instrument: string
  entryPrice: number
  currentPrice: number | null
  /** Stop loss price — used as the reference weight for proximity % */
  stopLoss?: number | null
  /** Trade direction — used for label context */
  direction?: "long" | "short"
  className?: string
}

export function PendingProgressBar({
  instrument,
  entryPrice,
  currentPrice,
  stopLoss,
  direction,
  className,
}: PendingProgressBarProps) {
  if (!currentPrice) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="bg-muted h-2.5 rounded-full" />
        <span className="text-muted-foreground text-[10px]">Waiting for price...</span>
      </div>
    )
  }

  const info = calculateDistanceInfo(instrument, currentPrice, entryPrice)

  // Reference weight: SL distance (or 100 pips fallback).
  // Formula: ref / (current + ref) * 100 → 100% at entry, decays smoothly as distance grows.
  // Unlike a linear scale, this never hits exactly 0% for non-zero distances.
  const referencePips = stopLoss
    ? Math.max(priceToPips(instrument, Math.abs(entryPrice - stopLoss)), 5)
    : 100

  const fillPercent =
    info.pips === 0 ? 100 : Math.min(100, (referencePips / (info.pips + referencePips)) * 100)
  const isClose = fillPercent >= 75
  const isMedium = fillPercent >= 40 && fillPercent < 75

  const dirLabel = direction === "long" ? "below" : "above"

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">
          {formatPips(info.pips)} {dirLabel} entry
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            isClose ? "text-green-500" : isMedium ? "text-amber-500" : "text-muted-foreground",
          )}
        >
          {Math.round(fillPercent)}%
        </span>
      </div>
      <div
        className="bg-muted h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(fillPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(fillPercent)}% to fill, ${formatPips(info.pips)} away`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isClose ? "bg-green-500" : isMedium ? "bg-amber-500" : "bg-status-connecting",
          )}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  )
}
