"use client"

import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TVSignalPerformanceStats } from "@fxflow/types"

interface PerfSignalFunnelProps {
  stats: TVSignalPerformanceStats | null
}

interface FunnelRow {
  label: string
  count: number
  percentage: number
  color: string
}

export function PerfSignalFunnel({ stats }: PerfSignalFunnelProps) {
  if (!stats || stats.totalSignals === 0) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <FunnelHeader />
        <p className="text-muted-foreground py-8 text-center text-sm">No signal data yet</p>
      </div>
    )
  }

  const profitable = stats.wins
  const execPct = stats.totalSignals > 0 ? (stats.executedSignals / stats.totalSignals) * 100 : 0
  const profitPct = stats.executedSignals > 0 ? (profitable / stats.executedSignals) * 100 : 0

  const rows: FunnelRow[] = [
    { label: "Total Signals", count: stats.totalSignals, percentage: 100, color: "bg-indigo-500" },
    { label: "Executed", count: stats.executedSignals, percentage: execPct, color: "bg-blue-500" },
    { label: "Profitable", count: profitable, percentage: profitPct, color: "bg-green-500" },
  ]

  return (
    <div className="bg-card rounded-xl border p-4">
      <FunnelHeader />
      <div className="mt-3 space-y-2" role="list" aria-label="Signal pipeline funnel">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3" role="listitem">
            <span className="text-muted-foreground w-24 shrink-0 text-xs">{row.label}</span>
            <div className="relative h-5 flex-1">
              <div
                className={cn("h-full rounded", row.color)}
                style={{ width: `${Math.max(row.percentage, 2)}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-sm font-medium tabular-nums">
              {row.count}
            </span>
            <span className="text-muted-foreground w-12 text-right font-mono text-xs tabular-nums">
              {row.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        {stats.rejectedSignals} rejected &middot; {stats.failedSignals} failed
      </p>
    </div>
  )
}

function FunnelHeader() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
      <Zap className="size-3" />
      Signal Pipeline
    </div>
  )
}
