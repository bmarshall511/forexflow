"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAiTraderPerformance, type PeriodDays } from "@/hooks/use-ai-trader-performance"
import { PerformanceSummary } from "./performance-summary"
import { PerformanceEquityCurve } from "./performance-equity-curve"
import { PerformanceProfiles } from "./performance-profiles"
import { PerformanceInstruments } from "./performance-instruments"
import { PerformanceSessions } from "./performance-sessions"
import { PerformanceTechniques } from "./performance-techniques"
import { PerformanceFunnel } from "./performance-funnel"
import { PerformanceCosts } from "./performance-costs"
import { PerformanceRegimes } from "./performance-regimes"
import { PerformanceConfidence } from "./performance-confidence"
import { PerformanceMfeMae } from "./performance-mfe-mae"
import { PerformanceTradeLog } from "./performance-trade-log"

const PERIODS: { label: string; value: PeriodDays }[] = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
  { label: "All", value: 0 },
]

export function PerformanceTab() {
  const {
    stats,
    overall,
    equityCurve,
    funnel,
    costs,
    regimeStats,
    confidenceBuckets,
    mfeMaeData,
    closedTrades,
    period,
    setPeriod,
    isLoading,
  } = useAiTraderPerformance()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-60" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">EdgeFinder Performance</h2>
        <div className="bg-muted flex rounded-lg p-0.5" role="radiogroup" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <PerformanceSummary overall={overall} />
      <PerformanceEquityCurve data={equityCurve} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PerformanceProfiles stats={stats} />
        <PerformanceFunnel funnel={funnel} />
      </div>

      <PerformanceInstruments stats={stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PerformanceSessions stats={stats} />
        <PerformanceTechniques stats={stats} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PerformanceRegimes data={regimeStats} />
        <PerformanceConfidence data={confidenceBuckets} />
      </div>

      <PerformanceMfeMae data={mfeMaeData} />
      <PerformanceCosts costs={costs} />
      <PerformanceTradeLog trades={closedTrades} />
    </div>
  )
}
