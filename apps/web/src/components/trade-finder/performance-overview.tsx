"use client"

import { useTradeFinderPerformance, type PeriodDays } from "@/hooks/use-trade-finder-performance"
import { cn } from "@/lib/utils"
import type { TradeFinderPerformanceData } from "@fxflow/db"

const PERIOD_OPTIONS: { value: PeriodDays; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 0, label: "All" },
]

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: "green" | "red" | "amber" | "default"
}) {
  const colorClass =
    color === "green"
      ? "text-green-500"
      : color === "red"
        ? "text-red-500"
        : color === "amber"
          ? "text-amber-500"
          : "text-foreground"
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className={cn("font-mono text-lg font-bold tabular-nums", colorClass)}>{value}</p>
      {sub && <p className="text-muted-foreground text-[10px]">{sub}</p>}
    </div>
  )
}

function DimensionTable({ title, data }: { title: string; data: TradeFinderPerformanceData[] }) {
  if (data.length === 0) return null
  return (
    <div>
      <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
        {title}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b text-left">
              <th className="pb-1.5 pr-3 font-medium">Key</th>
              <th className="pb-1.5 pr-3 text-right font-medium">Trades</th>
              <th className="pb-1.5 pr-3 text-right font-medium">Win %</th>
              <th className="pb-1.5 pr-3 text-right font-medium">P&L</th>
              <th className="pb-1.5 pr-3 text-right font-medium">Avg R:R</th>
              <th className="pb-1.5 text-right font-medium">PF</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const total = row.wins + row.losses + row.breakevens
              const winRate = total > 0 ? (row.wins / total) * 100 : 0
              return (
                <tr
                  key={`${row.dimensionKey ?? "all"}-${row.periodStart}`}
                  className="border-b border-dashed last:border-0"
                >
                  <td className="py-1.5 pr-3 font-mono">
                    {row.dimensionKey?.replace("_", "/") ?? "All"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{total}</td>
                  <td
                    className={cn(
                      "py-1.5 pr-3 text-right font-mono tabular-nums",
                      winRate >= 50
                        ? "text-green-500"
                        : winRate > 0
                          ? "text-red-500"
                          : "text-muted-foreground",
                    )}
                  >
                    {winRate.toFixed(0)}%
                  </td>
                  <td
                    className={cn(
                      "py-1.5 pr-3 text-right font-mono tabular-nums",
                      row.totalPL > 0 ? "text-green-500" : row.totalPL < 0 ? "text-red-500" : "",
                    )}
                  >
                    {row.totalPL >= 0 ? "+" : ""}
                    {row.totalPL.toFixed(2)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                    {row.avgRR.toFixed(1)}:1
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {row.profitFactor.toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PerformanceOverview() {
  const {
    overall,
    byTimeframe,
    byInstrument,
    byScoreRange,
    bySession,
    period,
    setPeriod,
    isLoading,
  } = useTradeFinderPerformance()

  if (isLoading) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">Loading performance data...</p>
    )
  }

  const totalTrades = overall ? overall.wins + overall.losses + overall.breakevens : 0

  if (totalTrades === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        <p>No Trade Finder trades have closed yet.</p>
        <p className="mt-1 text-xs">Performance data will appear here once trades are completed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              period === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {overall && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Win Rate"
            value={`${overall.winRate.toFixed(0)}%`}
            sub={`${overall.wins}W / ${overall.losses}L / ${overall.breakevens}BE`}
            color={overall.winRate >= 50 ? "green" : "red"}
          />
          <StatCard
            label="Total P&L"
            value={`${overall.totalPL >= 0 ? "+" : ""}$${overall.totalPL.toFixed(2)}`}
            color={overall.totalPL >= 0 ? "green" : "red"}
          />
          <StatCard
            label="Profit Factor"
            value={overall.profitFactor.toFixed(2)}
            color={
              overall.profitFactor >= 1.5 ? "green" : overall.profitFactor >= 1 ? "amber" : "red"
            }
          />
          <StatCard
            label="Avg R:R"
            value={`${overall.avgRR.toFixed(1)}:1`}
            sub={`Expected: ${overall.expectedRR.toFixed(1)}:1`}
          />
        </div>
      )}

      {/* Breakdown tables */}
      <div className="space-y-6">
        <DimensionTable title="By Score Range" data={byScoreRange} />
        <DimensionTable title="By Session" data={bySession} />
        <DimensionTable title="By Timeframe" data={byTimeframe} />
        <DimensionTable title="By Instrument" data={byInstrument} />
      </div>
    </div>
  )
}
