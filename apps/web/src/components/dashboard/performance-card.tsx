"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import type { EquityCurvePoint } from "@fxflow/types"
import { formatPnL } from "@fxflow/shared"
import { usePositions } from "@/hooks/use-positions"
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
  const [isLoading, setIsLoading] = useState(true)
  const { summary } = usePositions()

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const from = new Date()
    from.setDate(from.getDate() - Number(period))
    const params = new URLSearchParams({ dateFrom: from.toISOString() })

    fetch(`/api/analytics/equity-curve?${params}`)
      .then(async (res) => {
        const json = await res.json()
        if (!cancelled && json.ok) setData(json.data)
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

  // Calculate win streak
  const streak = useMemo(() => {
    if (data.length < 2) return null
    let count = 0
    let type: "W" | "L" | null = null

    // Walk backwards from most recent
    for (let i = data.length - 1; i > 0; i--) {
      const diff = data[i]!.cumulativePL - data[i - 1]!.cumulativePL
      const isWin = diff > 0
      if (type === null) {
        type = isWin ? "W" : "L"
        count = 1
      } else if ((isWin && type === "W") || (!isWin && type === "L")) {
        count++
      } else {
        break
      }
    }

    if (count < 2) return null
    return { count, type }
  }, [data])

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
                value={
                  summary.todayWins + summary.todayLosses > 0
                    ? `${Math.round((summary.todayWins / (summary.todayWins + summary.todayLosses)) * 100)}%`
                    : "—"
                }
                className={
                  summary.todayWins > summary.todayLosses
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
