"use client"

import { cn } from "@/lib/utils"

interface TradeHealthBarProps {
  /** 0–100: percentage from SL (0) to TP (100). Entry is at slPercent. */
  progressPercent: number
  /** Whether the trade has a stop loss set */
  hasSL: boolean
  /** Whether the trade has a take profit set */
  hasTP: boolean
  className?: string
}

/**
 * Visual bar showing a trade's current price position between SL and TP.
 * Left = SL (red), Right = TP (green), dot = current price.
 */
export function TradeHealthBar({ progressPercent, hasSL, hasTP, className }: TradeHealthBarProps) {
  const clamped = Math.max(0, Math.min(100, progressPercent))

  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Trade position: ${Math.round(clamped)}% toward take profit`}
    >
      {/* Background gradient: red → neutral → green */}
      <div className="via-muted absolute inset-0 rounded-full bg-gradient-to-r from-red-500/20 to-green-500/20" />

      {/* SL marker */}
      {hasSL && (
        <div className="bg-status-disconnected/60 absolute bottom-0 left-0 top-0 w-0.5 rounded-full" />
      )}

      {/* TP marker */}
      {hasTP && (
        <div className="bg-status-connected/60 absolute bottom-0 right-0 top-0 w-0.5 rounded-full" />
      )}

      {/* Current price dot */}
      <div
        className={cn(
          "border-background absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm transition-[left] duration-200 ease-out",
          clamped >= 60
            ? "bg-status-connected"
            : clamped <= 40
              ? "bg-status-disconnected"
              : "bg-status-warning",
        )}
        style={{ left: `${clamped}%` }}
      />
    </div>
  )
}
