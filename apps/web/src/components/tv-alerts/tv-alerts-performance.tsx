"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { DataTile, DonutChart, ProportionBar } from "@/components/ui/data-tile"
import {
  Trophy,
  Percent,
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react"
import type { TVSignalPerformanceStats } from "@fxflow/types"

interface TVAlertsPerformanceProps {
  stats: TVSignalPerformanceStats | null
  isLoading: boolean
}

export function TVAlertsPerformance({ stats, isLoading }: TVAlertsPerformanceProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!stats || stats.totalSignals === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        No signal data yet — performance metrics will appear after signals are processed
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hero row: Win rate donut + key metrics */}
      <div className="flex items-center gap-4">
        <DonutChart value={stats.winRate} size={56} strokeWidth={5} />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
          <DataTile
            label="W / L"
            value={
              <>
                <span className="text-status-connected">{stats.wins}W</span>
                {" / "}
                <span className="text-status-disconnected">{stats.losses}L</span>
              </>
            }
            variant="muted"
            icon={<Trophy className="size-3.5" />}
          />
          <DataTile
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            variant={stats.winRate >= 50 ? "positive" : "negative"}
            icon={<Percent className="size-3.5" />}
          />
          <DataTile
            label="Profit Factor"
            value={stats.profitFactor >= 999999 ? "\u221E" : stats.profitFactor.toFixed(2)}
            variant={stats.profitFactor >= 1 ? "positive" : "negative"}
            icon={<BarChart3 className="size-3.5" />}
          />
        </div>
      </div>

      {/* P&L metrics */}
      <div className="grid grid-cols-3 gap-2">
        <DataTile
          label="Total P&L"
          value={`$${stats.totalPL.toFixed(2)}`}
          variant={stats.totalPL >= 0 ? "positive" : "negative"}
          icon={
            stats.totalPL >= 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )
          }
        />
        <DataTile
          label="Avg Win"
          value={`$${stats.averageWin.toFixed(2)}`}
          variant="positive"
          icon={<CheckCircle2 className="size-3.5" />}
        />
        <DataTile
          label="Avg Loss"
          value={`$${stats.averageLoss.toFixed(2)}`}
          variant="negative"
          icon={<XCircle className="size-3.5" />}
        />
      </div>

      {/* Signal breakdown bar */}
      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
          <Zap className="size-3" />
          Signal Breakdown ({stats.totalSignals} total)
        </div>
        <ProportionBar
          segments={[
            {
              value: stats.executedSignals,
              color: "var(--color-status-connected)",
              label: "Executed",
            },
            {
              value: stats.rejectedSignals,
              color: "var(--color-status-warning)",
              label: "Rejected",
            },
            {
              value: stats.failedSignals,
              color: "var(--color-status-disconnected)",
              label: "Failed",
            },
          ]}
        />
      </div>
    </div>
  )
}
