"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useTVAlertsPerformance, type PerfPeriod } from "@/hooks/use-tv-alerts-performance"
import { PerfHeroMetrics } from "./perf-hero-metrics"
import { PerfPeriodPnl } from "./perf-period-pnl"
import { PerfEquityCurve } from "./perf-equity-curve"
import { PerfPairBreakdown } from "./perf-pair-breakdown"
import { PerfSignalFunnel } from "./perf-signal-funnel"
import { PerfStreakTracker } from "./perf-streak-tracker"
import { PerfDirectionComparison } from "./perf-direction-comparison"
import { PerfDistribution } from "./perf-distribution"
import { PerfSessionPerformance } from "./perf-session-performance"
import { PerfRecentResults } from "./perf-recent-results"
import { PerfSignalsByPair } from "./perf-signals-by-pair"

const PERIODS: { value: PerfPeriod; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
]

export function TVAlertsPerformance() {
  const perf = useTVAlertsPerformance()

  if (perf.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 min-w-[140px] flex-1 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-[240px] rounded-xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hero Metrics */}
      <PerfHeroMetrics summary={perf.summary} byInstrument={perf.byInstrument} />

      {/* Period P&L (always shows fixed periods, not filtered) */}
      <PerfPeriodPnl periodPnl={perf.periodPnl} />

      {/* Period Filter */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
          Detailed Analytics
        </p>
        <div className="bg-muted flex gap-0.5 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => perf.setPeriod(p.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                perf.period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Equity Curve */}
      <PerfEquityCurve data={perf.equityCurve} />

      {/* Two-column grid: Pair Breakdown + Signals by Pair */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PerfPairBreakdown data={perf.byInstrument} />
        <PerfSignalsByPair data={perf.detailed?.signalsByPair ?? []} />
      </div>

      {/* Signal Funnel */}
      <PerfSignalFunnel stats={perf.signalStats} />

      {/* Two-column grid: Streaks + Direction Comparison */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PerfStreakTracker summary={perf.summary} equityCurve={perf.equityCurve} />
        <PerfDirectionComparison summaryLong={perf.summaryLong} summaryShort={perf.summaryShort} />
      </div>

      {/* Two-column grid: Distribution + Sessions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PerfDistribution data={perf.detailed?.distribution ?? []} />
        <PerfSessionPerformance data={perf.bySession} />
      </div>

      {/* Recent Results */}
      <PerfRecentResults data={perf.detailed?.recentResults ?? []} />
    </div>
  )
}
