"use client"

import { ArrowLeftRight, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PerformanceSummary } from "@fxflow/types"

interface PerfDirectionComparisonProps {
  summaryLong: PerformanceSummary | null
  summaryShort: PerformanceSummary | null
}

function formatCurrency(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}$${value.toFixed(2)}`
}

export function PerfDirectionComparison({
  summaryLong,
  summaryShort,
}: PerfDirectionComparisonProps) {
  const longTrades = summaryLong?.totalTrades ?? 0
  const shortTrades = summaryShort?.totalTrades ?? 0

  if (longTrades === 0 && shortTrades === 0) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <DirectionHeader />
        <p className="text-muted-foreground py-8 text-center text-sm">No trade data yet</p>
      </div>
    )
  }

  const longPL = summaryLong?.totalPL ?? 0
  const shortPL = summaryShort?.totalPL ?? 0
  const longWins = longTrades > 0 && longPL >= shortPL
  const shortWins = shortTrades > 0 && shortPL > longPL

  return (
    <div className="bg-card rounded-xl border p-4">
      <DirectionHeader />
      <div className="mt-3 grid grid-cols-2 gap-4">
        {/* Buy / Long */}
        <div
          className={cn(
            "rounded-lg border-l-2 border-green-500 pl-3",
            longWins && "bg-green-500/5",
          )}
        >
          <div className="flex items-center gap-1 text-xs font-semibold text-green-500">
            <ArrowUp className="size-3" aria-hidden="true" />
            BUY
          </div>
          <StatList summary={summaryLong} />
        </div>

        {/* Sell / Short */}
        <div
          className={cn("rounded-lg border-l-2 border-red-500 pl-3", shortWins && "bg-red-500/5")}
        >
          <div className="flex items-center gap-1 text-xs font-semibold text-red-500">
            <ArrowDown className="size-3" aria-hidden="true" />
            SELL
          </div>
          <StatList summary={summaryShort} />
        </div>
      </div>
    </div>
  )
}

function StatList({ summary }: { summary: PerformanceSummary | null }) {
  if (!summary || summary.totalTrades === 0) {
    return <p className="text-muted-foreground mt-2 text-xs">No trades</p>
  }

  const stats = [
    { label: "Trades", value: String(summary.totalTrades) },
    { label: "Win Rate", value: `${(summary.winRate * 100).toFixed(1)}%` },
    {
      label: "Avg P&L",
      value: formatCurrency(summary.avgPL),
      colored: true,
      amount: summary.avgPL,
    },
    {
      label: "Total P&L",
      value: formatCurrency(summary.totalPL),
      colored: true,
      amount: summary.totalPL,
    },
  ]

  return (
    <div className="mt-2 space-y-1.5">
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-xs">{s.label}</span>
          <span
            className={cn(
              "font-mono text-xs font-medium tabular-nums",
              s.colored && (s.amount! >= 0 ? "text-green-500" : "text-red-500"),
            )}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function DirectionHeader() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
      <ArrowLeftRight className="size-3" />
      Buy vs Sell
    </div>
  )
}
