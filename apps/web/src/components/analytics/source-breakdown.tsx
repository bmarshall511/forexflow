"use client"

import { useMemo } from "react"
import type { SourcePerformance, TradeSource } from "@fxflow/types"
import { SourceBadge } from "@/components/positions/source-badge"
import { cn } from "@/lib/utils"

interface Props {
  data: SourcePerformance[]
}

const DONUT_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
]

const KNOWN_SOURCES: Set<string> = new Set([
  "oanda",
  "manual",
  "automated",
  "ut_bot_alerts",
  "trade_finder",
  "trade_finder_auto",
  "ai_trader",
])

function fmtPL(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`
}

function plColor(v: number): string {
  if (v > 0) return "text-green-600 dark:text-green-400"
  if (v < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

export function SourceBreakdown({ data }: Props) {
  const totalTrades = useMemo(() => data.reduce((s, d) => s + d.trades, 0), [data])

  const segments = useMemo(() => {
    let cumulative = 0
    return data.map((d, i) => {
      const pct = totalTrades > 0 ? (d.trades / totalTrades) * 100 : 0
      const offset = cumulative
      cumulative += pct
      return { ...d, pct, offset, color: DONUT_COLORS[i % DONUT_COLORS.length]! }
    })
  }, [data, totalTrades])

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">No source data available</p>
    )
  }

  // CSS conic-gradient donut
  const conicStops = segments.map((s) => `${s.color} ${s.offset}% ${s.offset + s.pct}%`).join(", ")

  return (
    <div className="space-y-6" role="region" aria-label="Performance by trade source">
      <p className="text-muted-foreground text-sm">Where your trades came from</p>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
        {/* Donut chart */}
        <div
          className="relative size-48 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${conicStops})` }}
          role="img"
          aria-label="Trade source distribution"
        >
          <div className="bg-background absolute inset-6 flex flex-col items-center justify-center rounded-full">
            <span className="text-2xl font-bold tabular-nums">{totalTrades}</span>
            <span className="text-muted-foreground text-xs">total trades</span>
          </div>
        </div>

        {/* Legend + stats */}
        <div className="w-full max-w-sm space-y-2">
          {segments.map((s) => (
            <div key={s.source} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {KNOWN_SOURCES.has(s.source) ? (
                      <SourceBadge source={s.source as TradeSource} />
                    ) : (
                      s.sourceLabel
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {s.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.trades} trades</span>
                  <span className={cn("font-semibold tabular-nums", plColor(s.totalPL))}>
                    {fmtPL(s.totalPL)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
