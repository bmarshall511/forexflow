"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { DonutChart } from "@/components/ui/data-tile"
import { TrendingUp, TrendingDown, Scale, Target, Trophy } from "lucide-react"
import type { PerformanceSummary, InstrumentPerformance } from "@fxflow/types"

interface PerfHeroMetricsProps {
  summary: PerformanceSummary | null
  byInstrument: InstrumentPerformance[]
}

function MetricCard({
  icon,
  label,
  children,
  className,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-border/50 bg-card min-w-[140px] snap-center rounded-xl border p-3",
        "md:snap-align-none",
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export function PerfHeroMetrics({ summary, byInstrument }: PerfHeroMetricsProps) {
  const bestPair = useMemo(() => {
    if (byInstrument.length === 0) return null
    return byInstrument.reduce((best, cur) => (cur.totalPL > best.totalPL ? cur : best))
  }, [byInstrument])

  if (!summary) return null

  const isProfit = summary.totalPL >= 0
  const winRatePct = summary.winRate * 100
  const profitFactorDisplay =
    summary.profitFactor >= 999 ? "\u221E" : summary.profitFactor.toFixed(2)
  const expectancyPositive = summary.expectancy >= 0

  return (
    <div
      className={cn(
        "scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto",
        "md:grid md:grid-cols-5 md:overflow-visible",
      )}
      role="region"
      aria-label="Performance summary metrics"
    >
      {/* Total P&L */}
      <MetricCard
        icon={
          isProfit ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />
        }
        label="Total P&L"
      >
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular-nums",
            isProfit ? "text-status-connected" : "text-status-disconnected",
          )}
        >
          ${summary.totalPL.toFixed(2)}
        </span>
      </MetricCard>

      {/* Win Rate */}
      <MetricCard icon={<Target className="size-3.5" />} label="Win Rate">
        <div className="flex items-center gap-2">
          <DonutChart value={winRatePct} size={36} strokeWidth={3} />
          <span className="font-mono text-lg font-semibold tabular-nums">
            {winRatePct.toFixed(1)}%
          </span>
        </div>
      </MetricCard>

      {/* Profit Factor */}
      <MetricCard icon={<Scale className="size-3.5" />} label="Profit Factor">
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular-nums",
            summary.profitFactor >= 1 ? "text-status-connected" : "text-status-disconnected",
          )}
        >
          {profitFactorDisplay}
        </span>
      </MetricCard>

      {/* Expectancy */}
      <MetricCard icon={<TrendingUp className="size-3.5" />} label="Expectancy">
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular-nums",
            expectancyPositive ? "text-status-connected" : "text-status-disconnected",
          )}
        >
          ${summary.expectancy.toFixed(2)}
        </span>
      </MetricCard>

      {/* Best Pair */}
      <MetricCard icon={<Trophy className="size-3.5" />} label="Best Pair">
        {bestPair ? (
          <div>
            <span className="text-foreground text-sm font-medium">
              {bestPair.instrument.replace("_", "/")}
            </span>
            <span
              className={cn(
                "ml-1.5 font-mono text-sm font-semibold tabular-nums",
                bestPair.totalPL >= 0 ? "text-status-connected" : "text-status-disconnected",
              )}
            >
              ${bestPair.totalPL.toFixed(2)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </MetricCard>
    </div>
  )
}
