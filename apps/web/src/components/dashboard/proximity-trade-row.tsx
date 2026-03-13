"use client"

import { cn } from "@/lib/utils"
import { DirectionBadge } from "@/components/positions/direction-badge"
import type { TradeDirection } from "@fxflow/types"

interface ProximityTradeRowProps {
  instrument: string
  direction: TradeDirection
  /** Primary value displayed on the right (e.g., "$45.23" or "85%") */
  value: string
  valueClassName?: string
  /** Secondary detail text (e.g., "Near SL", "12.3p away") */
  detail?: string
  detailClassName?: string
  /** Optional inline content between label and value (e.g., progress bar) */
  children?: React.ReactNode
  onClick?: () => void
  ariaLabel: string
}

export function ProximityTradeRow({
  instrument,
  direction,
  value,
  valueClassName,
  detail,
  detailClassName,
  children,
  onClick,
  ariaLabel,
}: ProximityTradeRowProps) {
  const pair = instrument.replace("_", "/")

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
        "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Left: pair + direction */}
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <span className="text-xs font-medium">{pair}</span>
        <DirectionBadge direction={direction} />
      </div>

      {/* Center: detail + optional children (progress bar) */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {detail && (
          <span className={cn("text-[10px] font-medium", detailClassName)}>
            {detail}
          </span>
        )}
        {children}
      </div>

      {/* Right: value */}
      <span
        className={cn(
          "shrink-0 text-xs font-semibold font-mono tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </span>
    </button>
  )
}
