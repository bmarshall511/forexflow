"use client"

import { useState, useMemo } from "react"
import { useSourceStats } from "@/hooks/use-source-stats"
import { usePositions } from "@/hooks/use-positions"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { formatPnL, formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react"
import type { SourceDetailedPerformance, SourcePeriodStats, TradeSource } from "@fxflow/types"

// ─── Period selector ────────────────────────────────────────────────────────

type Period = "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime"

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  thisWeek: "Week",
  thisMonth: "Month",
  thisYear: "Year",
  allTime: "All",
}

// ─── Source row ──────────────────────────────────────────────────────────────

interface SourceRowProps {
  source: SourceDetailedPerformance
  period: Period
  currency: string
}

function SourceRow({ source, period, currency }: SourceRowProps) {
  const stats: SourcePeriodStats = source[period]
  const pnl = formatPnL(stats.totalPL, currency)
  const hasOpenTrades = source.openTrades > 0
  const unrealizedPnl = hasOpenTrades ? formatPnL(source.unrealizedPL, currency) : null

  if (stats.trades === 0 && !hasOpenTrades) return null

  return (
    <div className="border-border/30 space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
      {/* Source header + realized P&L */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SourceDot source={source.source as TradeSource} />
          <span className="text-sm font-medium">{source.sourceLabel}</span>
        </div>
        <span
          className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            pnl.colorIntent === "positive"
              ? "text-status-connected"
              : pnl.colorIntent === "negative"
                ? "text-status-disconnected"
                : "text-muted-foreground",
          )}
        >
          {stats.trades > 0 ? pnl.formatted : "—"}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] sm:grid-cols-5">
        {stats.trades > 0 && (
          <>
            <StatCell label="Trades" value={`${stats.wins}W / ${stats.losses}L`} />
            <StatCell
              label="Win Rate"
              value={`${Math.round(stats.winRate * 100)}%`}
              intent={stats.winRate >= 0.5 ? "positive" : "negative"}
            />
            <StatCell
              label="Avg R:R"
              value={stats.avgRR > 0 ? `${stats.avgRR.toFixed(1)}:1` : "—"}
            />
            <StatCell
              label="Avg Win"
              value={stats.avgWin > 0 ? formatCurrency(stats.avgWin, currency) : "—"}
              intent="positive"
              className="hidden sm:block"
            />
            <StatCell
              label="Avg Loss"
              value={stats.avgLoss < 0 ? formatCurrency(Math.abs(stats.avgLoss), currency) : "—"}
              intent="negative"
              className="hidden sm:block"
            />
          </>
        )}
      </div>

      {/* Open trades unrealized P&L */}
      {hasOpenTrades && unrealizedPnl && (
        <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
          {source.unrealizedPL >= 0 ? (
            <TrendingUp className="text-status-connected size-3" />
          ) : (
            <TrendingDown className="text-status-disconnected size-3" />
          )}
          <span>
            {source.openTrades} open ·{" "}
            <span
              className={cn(
                "font-medium tabular-nums",
                unrealizedPnl.colorIntent === "positive"
                  ? "text-status-connected"
                  : unrealizedPnl.colorIntent === "negative"
                    ? "text-status-disconnected"
                    : "",
              )}
            >
              {unrealizedPnl.formatted}
            </span>{" "}
            unrealized
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  intent,
  className,
}: {
  label: string
  value: string
  intent?: "positive" | "negative"
  className?: string
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="text-muted-foreground/60 uppercase tracking-wider">{label}</div>
      <div
        className={cn(
          "font-medium tabular-nums",
          intent === "positive" && "text-status-connected",
          intent === "negative" && "text-status-disconnected",
        )}
      >
        {value}
      </div>
    </div>
  )
}

const SOURCE_COLORS: Partial<Record<TradeSource, string>> = {
  oanda: "bg-blue-500",
  manual: "bg-amber-500",
  ut_bot_alerts: "bg-emerald-500",
  trade_finder: "bg-violet-500",
  trade_finder_auto: "bg-violet-500",
  ai_trader: "bg-indigo-500",
}

function SourceDot({ source }: { source: TradeSource }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", SOURCE_COLORS[source] ?? "bg-muted-foreground")}
    />
  )
}

// ─── Main card ──────────────────────────────────────────────────────────────

export function SourcePerformanceCard() {
  const { sources, isLoading } = useSourceStats()
  const [period, setPeriod] = useState<Period>("thisWeek")
  const { accountOverview } = useDaemonStatus()
  const currency = accountOverview?.summary.currency ?? "USD"

  // Filter to sources that have any data
  const activeSources = useMemo(
    () => sources.filter((s) => s.allTime.trades > 0 || s.openTrades > 0),
    [sources],
  )

  if (isLoading) {
    return (
      <div className="bg-card border-border/50 space-y-3 rounded-xl border p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (activeSources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
        <BarChart3 className="text-muted-foreground size-8" />
        <p className="text-sm font-medium">No trade data yet</p>
        <p className="text-muted-foreground text-xs">
          Performance by source will appear after your first closed trade
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-card border-border/50 rounded-xl border",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
      )}
      style={{ animationDelay: "250ms" }}
    >
      {/* Header + period tabs */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <BarChart3 className="size-3.5" />
          Performance by Source
        </h2>
        <div className="bg-muted flex gap-0.5 rounded-lg p-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Source rows */}
      <div className="space-y-3 p-4">
        {activeSources.map((source) => (
          <SourceRow key={source.source} source={source} period={period} currency={currency} />
        ))}
      </div>
    </div>
  )
}
