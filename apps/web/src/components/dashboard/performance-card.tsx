"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import type { EquityCurvePoint, PerformanceSummary } from "@fxflow/types"
import { formatPnL } from "@fxflow/shared"
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { EquityCurveChart } from "@/components/analytics/equity-curve-chart"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TrendingUp, Trophy, Flame, Target } from "lucide-react"

// ─── Period selector ─────────────────────────────────────────────────────────

type Period = "7" | "30" | "90"

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const periods: { value: Period; label: string }[] = [
    { value: "7", label: "7D" },
    { value: "30", label: "30D" },
    { value: "90", label: "90D" },
  ]

  return (
    <div className="bg-muted inline-flex rounded-lg p-0.5">
      {periods.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
            value === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ─── Stat pill ───────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <Icon className={cn("size-3", className)} />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold tabular-nums", className)}>{value}</span>
    </div>
  )
}

// ─── Main card ───────────────────────────────────────────────────────────────

export function PerformanceCard() {
  const [period, setPeriod] = useState<Period>("30")
  const [data, setData] = useState<EquityCurvePoint[]>([])
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const from = new Date()
    from.setDate(from.getDate() - Number(period))
    const params = new URLSearchParams({ dateFrom: from.toISOString() })

    // Pull equity curve + summary in parallel so win-rate / streak match the
    // selected period rather than today-only counts from the positions hook.
    Promise.all([
      fetch(`/api/analytics/equity-curve?${params}`).then((res) => res.json()),
      fetch(`/api/analytics/summary?${params}`).then((res) => res.json()),
    ])
      .then(([curveJson, summaryJson]) => {
        if (cancelled) return
        if (curveJson.ok) setData(curveJson.data)
        if (summaryJson.ok) setSummary(summaryJson.data)
      })
      .catch((err) => console.error("[PerformanceCard] fetch error:", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [period])

  const cumulativePL = data.length > 0 ? data[data.length - 1]!.cumulativePL : 0
  const pnl = formatPnL(cumulativePL)

  // Period-scoped win rate pulled from PerformanceSummary (realized trades in
  // the selected window, scoped to the active account). Replaces the old
  // today-only computation that was independent of the period toggle.
  const winRatePct = useMemo(() => {
    if (!summary || summary.totalTrades === 0) return null
    return Math.round(summary.winRate * 100)
  }, [summary])

  // Streak also comes from the summary (current consecutive win/loss run
  // across realized trades). The prior equity-curve-diff approach measured
  // winning *days*, not winning trades.
  const streak = useMemo(() => {
    if (!summary || summary.currentStreak.count < 2) return null
    return {
      count: summary.currentStreak.count,
      type: summary.currentStreak.type === "win" ? ("W" as const) : ("L" as const),
    }
  }, [summary])

  return (
    <Card
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: "350ms" }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4" />
          Performance
        </CardTitle>
        <CardAction>
          <PeriodToggle value={period} onChange={setPeriod} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-[140px] w-full rounded-lg" />
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <TrendingUp className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">No trades in this period</p>
          </div>
        ) : (
          <>
            {/* P&L headline */}
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">Last {period} days</span>
              <AnimatedNumber
                value={pnl.formatted}
                className={cn(
                  "text-lg font-bold tabular-nums",
                  pnl.colorIntent === "positive"
                    ? "text-status-connected"
                    : pnl.colorIntent === "negative"
                      ? "text-status-disconnected"
                      : "text-muted-foreground",
                )}
              />
            </div>

            {/* Chart */}
            <EquityCurveChart data={data} height={140} compact />

            {/* Stats row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <StatPill
                icon={Target}
                label="Win rate"
                value={winRatePct !== null ? `${winRatePct}%` : "—"}
                className={
                  winRatePct !== null && winRatePct >= 50
                    ? "text-status-connected"
                    : "text-muted-foreground"
                }
              />
              {streak && (
                <StatPill
                  icon={streak.type === "W" ? Trophy : Flame}
                  label="Streak"
                  value={`${streak.count}${streak.type}`}
                  className={
                    streak.type === "W" ? "text-status-connected" : "text-status-disconnected"
                  }
                />
              )}
            </div>
          </>
        )}
      </CardContent>

      <CardFooter>
        <Link
          href="/analytics"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          View full analytics →
        </Link>
      </CardFooter>
    </Card>
  )
}
