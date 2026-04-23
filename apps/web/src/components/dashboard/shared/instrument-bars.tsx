"use client"

import { useMemo } from "react"
import type { InstrumentPerformance } from "@fxflow/types"
import { formatCurrency, formatInstrument } from "@fxflow/shared"
import { cn } from "@/lib/utils"

/**
 * Top-N instruments by absolute P&L contribution. Render as horizontal bars
 * that fan out left (red) and right (green) from a shared center so wins
 * and losses are directly comparable.
 */
interface InstrumentBarsProps {
  data: InstrumentPerformance[]
  top?: number
  currency?: string
  className?: string
}

export function InstrumentBars({
  data,
  top = 8,
  currency = "USD",
  className,
}: InstrumentBarsProps) {
  const { rows, maxAbs } = useMemo(() => {
    const sorted = [...data]
      .filter((r) => r.trades > 0)
      .sort((a, b) => Math.abs(b.totalPL) - Math.abs(a.totalPL))
      .slice(0, top)
    const maxAbs = sorted.reduce((m, r) => Math.max(m, Math.abs(r.totalPL)), 0) || 1
    return { rows: sorted, maxAbs }
  }, [data, top])

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed p-4 text-xs",
          className,
        )}
      >
        No instrument data yet
      </div>
    )
  }

  return (
    <ul className={cn("space-y-1.5", className)} role="list">
      {rows.map((row) => {
        const widthPct = (Math.abs(row.totalPL) / maxAbs) * 50 // 50% half-width
        const isWin = row.totalPL >= 0
        const winRatePct = Math.round(row.winRate * 100)
        return (
          <li
            key={row.instrument}
            className="grid grid-cols-[72px_1fr_auto] items-center gap-2 text-xs"
            role="listitem"
          >
            <span className="text-muted-foreground font-mono">
              {formatInstrument(row.instrument)}
            </span>
            <div className="relative h-5">
              {/* Center tick */}
              <div className="bg-border absolute left-1/2 top-0 h-full w-px -translate-x-1/2" />
              <div
                className={cn(
                  "absolute top-0 h-full rounded-sm transition-all",
                  isWin ? "bg-status-connected/70 left-1/2" : "bg-status-disconnected/70 right-1/2",
                )}
                style={{ width: `${widthPct}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] tabular-nums">
              <span
                className={cn(
                  "font-mono font-semibold",
                  isWin ? "text-status-connected" : "text-status-disconnected",
                )}
                data-private="true"
              >
                {formatCurrency(row.totalPL, currency)}
              </span>
              <span className="text-muted-foreground/70">
                {row.trades}T · {winRatePct}%
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
