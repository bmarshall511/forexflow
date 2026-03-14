"use client"

import { useMemo } from "react"
import type { InstrumentPerformance } from "@fxflow/types"
import { cn } from "@/lib/utils"

interface Props {
  data: InstrumentPerformance[]
}

function fmtPL(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`
}

function plColor(v: number): string {
  if (v > 0) return "text-green-600 dark:text-green-400"
  if (v < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

function InstrumentCard({ row }: { row: InstrumentPerformance }) {
  const winPct = row.winRate * 100
  const isProfit = row.totalPL >= 0

  return (
    <div
      className={cn(
        "border-border/50 rounded-xl border p-4 transition-colors",
        isProfit ? "bg-green-500/5 hover:bg-green-500/10" : "bg-red-500/5 hover:bg-red-500/10",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{row.instrument.replace("_", "/")}</h3>
        <span className="text-muted-foreground text-xs">
          {row.trades} {row.trades === 1 ? "trade" : "trades"}
        </span>
      </div>

      {/* Win rate progress bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Win rate</span>
          <span
            className={cn("font-semibold tabular-nums", winPct >= 50 ? plColor(1) : plColor(-1))}
          >
            {winPct.toFixed(0)}%
          </span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              winPct >= 50 ? "bg-green-500" : "bg-red-500",
            )}
            style={{ width: `${Math.min(winPct, 100)}%` }}
            role="meter"
            aria-label={`Win rate: ${winPct.toFixed(0)}%`}
            aria-valuenow={winPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* P&L */}
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-muted-foreground text-xs">Profit / Loss</span>
        <span className={cn("text-lg font-bold tabular-nums", plColor(row.totalPL))}>
          {fmtPL(row.totalPL)}
        </span>
      </div>
    </div>
  )
}

export function InstrumentTable({ data }: Props) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.trades - a.trades), [data])

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">No instrument data available</p>
    )
  }

  return (
    <div role="region" aria-label="Performance by currency pair">
      <p className="text-muted-foreground mb-4 text-sm">
        Your results for each currency pair, sorted by most traded
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((row) => (
          <InstrumentCard key={row.instrument} row={row} />
        ))}
      </div>
    </div>
  )
}
