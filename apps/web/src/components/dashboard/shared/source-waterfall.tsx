"use client"

import { useMemo } from "react"
import type { SourceDetailedPerformance } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"

/**
 * Source waterfall — starting balance → per-source contribution → ending
 * balance for the selected period. Built as a CSS flex row rather than a
 * recharts chart because the shape is simple and this keeps bundle size
 * down for a tile that appears once on the dashboard.
 *
 * Sources are ordered largest absolute contribution first so the biggest
 * driver is always on the left.
 */
type SourcePeriod = "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime"

interface SourceWaterfallProps {
  data: SourceDetailedPerformance[]
  period: SourcePeriod
  currency?: string
  className?: string
}

interface Step {
  source: string
  label: string
  delta: number
  trades: number
  winRate: number
}

export function SourceWaterfall({
  data,
  period,
  currency = "USD",
  className,
}: SourceWaterfallProps) {
  const { steps, totalAbs, net } = useMemo(() => {
    const steps: Step[] = []
    for (const s of data) {
      const stats = s[period]
      if (stats.trades === 0) continue
      steps.push({
        source: s.source,
        label: s.sourceLabel,
        delta: stats.totalPL,
        trades: stats.trades,
        winRate: stats.winRate,
      })
    }
    steps.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    const totalAbs = steps.reduce((sum, s) => sum + Math.abs(s.delta), 0) || 1
    const net = steps.reduce((sum, s) => sum + s.delta, 0)
    return { steps, totalAbs, net }
  }, [data, period])

  if (steps.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed p-4 text-xs",
          className,
        )}
      >
        No P&L to attribute for this period
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="bg-muted/30 flex h-8 w-full overflow-hidden rounded-md"
        role="img"
        aria-label="Source contribution to total P&L"
      >
        {steps.map((s) => {
          const widthPct = (Math.abs(s.delta) / totalAbs) * 100
          const isWin = s.delta >= 0
          return (
            <div
              key={s.source}
              className={cn(
                "flex items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-medium text-white/90",
                isWin ? "bg-status-connected" : "bg-status-disconnected",
              )}
              style={{ width: `${widthPct}%` }}
              title={`${s.label}: ${formatCurrency(s.delta, currency)} · ${s.trades} trade${s.trades !== 1 ? "s" : ""}`}
            >
              {widthPct > 12 && <span className="truncate px-1">{s.label}</span>}
            </div>
          )
        })}
      </div>

      <ul className="space-y-1" role="list">
        {steps.map((s) => {
          const isWin = s.delta >= 0
          const contributionPct = Math.round((Math.abs(s.delta) / totalAbs) * 100)
          return (
            <li
              key={s.source}
              className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs"
              role="listitem"
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    isWin ? "bg-status-connected" : "bg-status-disconnected",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{s.label}</span>
                <span className="text-muted-foreground/60 shrink-0 text-[10px]">
                  {contributionPct}%
                </span>
              </span>
              <span className="flex items-center gap-3 tabular-nums">
                <span
                  className={cn(
                    "font-mono font-medium",
                    isWin ? "text-status-connected" : "text-status-disconnected",
                  )}
                  data-private="true"
                >
                  {formatCurrency(s.delta, currency)}
                </span>
                <span className="text-muted-foreground/70 text-[10px]">
                  {s.trades}T · {Math.round(s.winRate * 100)}%
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
        <span>Net</span>
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            net >= 0 ? "text-status-connected" : "text-status-disconnected",
          )}
          data-private="true"
        >
          {formatCurrency(net, currency)}
        </span>
      </div>
    </div>
  )
}
