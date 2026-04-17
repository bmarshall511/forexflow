"use client"

import { getPipSize, formatPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface OpenProgressBarProps {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  className?: string
}

export function OpenProgressBar({
  instrument,
  direction,
  entryPrice,
  currentPrice,
  stopLoss,
  takeProfit,
  className,
}: OpenProgressBarProps) {
  const pipSize = getPipSize(instrument)

  if (!stopLoss && !takeProfit) {
    return (
      <div className={cn("text-muted-foreground/50 text-[10px] italic", className)}>
        No stop loss or target set
      </div>
    )
  }

  // SL distance is SIGNED: positive = normal risk, negative = SL in profit territory
  const rawSlPips = stopLoss
    ? (direction === "long" ? entryPrice - stopLoss : stopLoss - entryPrice) / pipSize
    : null
  const tpPips = takeProfit
    ? Math.abs(direction === "long" ? takeProfit - entryPrice : entryPrice - takeProfit) / pipSize
    : null

  const slInProfit = rawSlPips !== null && rawSlPips < -0.5
  const slPips = rawSlPips !== null ? Math.abs(rawSlPips) : null

  const effectiveSlPips = slPips !== null && slPips >= 0.5 ? slPips : null
  const effectiveTpPips = tpPips !== null && tpPips >= 0.5 ? tpPips : null

  if (!effectiveSlPips && !effectiveTpPips) {
    return (
      <div className={cn("text-muted-foreground/50 text-[10px] italic", className)}>
        No stop loss or target set
      </div>
    )
  }

  // Current pips from entry (positive = toward TP)
  let currentPips = 0
  if (currentPrice !== null && currentPrice !== 0) {
    const priceDiff = currentPrice - entryPrice
    currentPips = direction === "long" ? priceDiff / pipSize : -priceDiff / pipSize
  }

  const isInProfit = currentPips > 0

  // When SL is profit-protected, use a different bar layout:
  // [entry=0] ───── [SL=locked] ──────── [TP=target]
  // The entire bar is green (all profit territory).
  if (slInProfit && effectiveSlPips !== null) {
    // Range: from entry (0 pips profit) to TP
    const totalRange = effectiveTpPips ?? effectiveSlPips * 2
    const slPercent = (effectiveSlPips / totalRange) * 100
    const progress = (currentPips / totalRange) * 100
    const clampedProgress = Math.max(0, Math.min(100, progress))

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="bg-muted/60 relative h-3 overflow-hidden rounded-full">
          {/* Entire bar is profit territory */}
          <div className="absolute inset-0 rounded-full bg-green-500/15" />
          {/* SL marker (locked profit level) */}
          <div
            className="absolute inset-y-0 z-10 w-[2px] bg-green-500/40"
            style={{ left: `${Math.min(slPercent, 100)}%` }}
          />
          {/* Current price indicator */}
          <div
            className="absolute top-0 z-20 h-full w-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)] transition-all duration-300"
            style={{ left: `calc(${clampedProgress}% - 5px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] tabular-nums">
          <span className="text-green-500/70">Locked +{formatPips(effectiveSlPips)}p</span>
          <span className="font-medium text-green-500">+{formatPips(currentPips)}p</span>
          <span className="text-green-500/70">
            {effectiveTpPips !== null ? `Target ${formatPips(effectiveTpPips)}p` : "No target"}
          </span>
        </div>
      </div>
    )
  }

  // Normal layout: [SL=risk] ──── [entry] ──────── [TP=target]
  const totalRange = (effectiveSlPips ?? 0) + (effectiveTpPips ?? 0)
  if (totalRange === 0) return null

  const slSide = effectiveSlPips ?? totalRange / 2
  const progress = ((currentPips + slSide) / totalRange) * 100
  const clampedProgress = Math.max(0, Math.min(100, progress))
  const entryPercent = (slSide / totalRange) * 100

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="bg-muted/60 relative h-3 overflow-hidden rounded-full">
        {/* SL zone (red, left of entry) */}
        {effectiveSlPips !== null && (
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-red-500/15"
            style={{ width: `${entryPercent}%` }}
          />
        )}
        {/* TP zone (green, right of entry) */}
        {effectiveTpPips !== null && (
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-green-500/15"
            style={{ width: `${100 - entryPercent}%` }}
          />
        )}
        {/* Entry marker */}
        <div
          className="bg-foreground/20 absolute inset-y-0 z-10 w-[2px]"
          style={{ left: `${entryPercent}%` }}
        />
        {/* Current price indicator */}
        <div
          className={cn(
            "absolute top-0 z-20 h-full w-2.5 rounded-full transition-all duration-300",
            isInProfit
              ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]"
              : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]",
          )}
          style={{ left: `calc(${clampedProgress}% - 5px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums">
        <span className="text-red-500/70">
          {effectiveSlPips !== null ? `Stop ${formatPips(effectiveSlPips)}p` : "No stop"}
        </span>
        <span className={cn("font-medium", isInProfit ? "text-green-500" : "text-red-500")}>
          {currentPips >= 0 ? "+" : ""}
          {formatPips(currentPips)}p
        </span>
        <span className="text-green-500/70">
          {effectiveTpPips !== null ? `Target ${formatPips(effectiveTpPips)}p` : "No target"}
        </span>
      </div>
    </div>
  )
}
