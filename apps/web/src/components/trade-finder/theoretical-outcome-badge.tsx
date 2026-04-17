"use client"

import type { TradeFinderTheoreticalOutcome } from "@fxflow/types"
import { cn } from "@/lib/utils"

interface TheoreticalOutcomeBadgeProps {
  outcome: TradeFinderTheoreticalOutcome | null
}

/**
 * Badge showing whether a trade would have reached its TP/SL after being closed.
 * Helps the user evaluate whether management rules are helping or hurting.
 */
export function TheoreticalOutcomeBadge({ outcome }: TheoreticalOutcomeBadgeProps) {
  if (!outcome) return null

  if (outcome.reachedTP && !outcome.reachedSL) {
    return (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-medium",
          "bg-green-500/10 text-green-400",
        )}
        title={`Would have hit TP (+${outcome.maxFavorableAfterClose}p MFE, ${outcome.monitoredHours}h monitored)`}
      >
        Would hit TP
      </span>
    )
  }

  if (outcome.reachedSL && !outcome.reachedTP) {
    return (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-medium",
          "bg-blue-500/10 text-blue-400",
        )}
        title={`SL would have been hit — exit was correct (${outcome.monitoredHours}h monitored)`}
      >
        SL correct
      </span>
    )
  }

  if (outcome.reachedTP && outcome.reachedSL) {
    return (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-medium",
          "bg-amber-500/10 text-amber-400",
        )}
        title={`Both TP and SL would have been hit — timing mattered (${outcome.monitoredHours}h monitored)`}
      >
        Mixed
      </span>
    )
  }

  // Neither reached — price stayed in range
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        "bg-zinc-500/10 text-zinc-400",
      )}
      title={`Neither TP nor SL reached in ${outcome.monitoredHours}h after close`}
    >
      Flat
    </span>
  )
}
