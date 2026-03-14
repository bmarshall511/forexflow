"use client"

import type { PerformanceSummary } from "@fxflow/types"
import {
  Hash,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react"
import { DataTile, DonutChart } from "@/components/ui/data-tile"

interface Props {
  summary: PerformanceSummary
}

function fmtPL(v: number): string {
  const prefix = v >= 0 ? "+" : ""
  return `${prefix}${v.toFixed(2)}`
}

function plVariant(v: number): "positive" | "negative" | "default" {
  if (v > 0) return "positive"
  if (v < 0) return "negative"
  return "default"
}

export function AnalyticsSummaryBar({ summary }: Props) {
  const { totalTrades, winRate, totalPL, largestWin, largestLoss, avgPL } = summary
  const winPct = winRate * 100

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      role="region"
      aria-label="Performance summary"
    >
      <DataTile
        label="Total Trades"
        value={String(totalTrades)}
        icon={<Hash className="size-3.5" />}
        subtitle={`${summary.wins} wins, ${summary.losses} losses`}
      />
      <DataTile
        label="Win Rate"
        value={<DonutChart value={winPct} size={44} strokeWidth={4} />}
        icon={<Target className="size-3.5" />}
        variant={winPct >= 50 ? "positive" : "negative"}
      />
      <DataTile
        label="Total Profit"
        value={fmtPL(totalPL)}
        icon={
          totalPL >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />
        }
        variant={plVariant(totalPL)}
      />
      <DataTile
        label="Best Trade"
        value={fmtPL(largestWin)}
        icon={<ArrowUpRight className="size-3.5" />}
        variant="positive"
      />
      <DataTile
        label="Worst Trade"
        value={fmtPL(largestLoss)}
        icon={<ArrowDownRight className="size-3.5" />}
        variant="negative"
      />
      <DataTile
        label="Average Trade"
        value={fmtPL(avgPL)}
        icon={<BarChart3 className="size-3.5" />}
        variant={plVariant(avgPL)}
      />
    </div>
  )
}
