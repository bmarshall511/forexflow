"use client"

import { useMemo } from "react"
import type { AiTraderStrategyPerformanceData } from "@fxflow/types"
import { cn } from "@/lib/utils"

interface Props {
  stats: AiTraderStrategyPerformanceData[]
}

const TECHNIQUE_LABELS: Record<string, string> = {
  smc_structure: "SMC Structure",
  fair_value_gap: "Fair Value Gap",
  order_block: "Order Block",
  liquidity_sweep: "Liquidity Sweep",
  supply_demand_zone: "Supply & Demand",
  fibonacci_extensions: "Fibonacci",
  rsi: "RSI",
  macd: "MACD",
  ema: "EMA",
  bollinger_bands: "Bollinger Bands",
  williams_percent_r: "Williams %R",
  adx: "ADX",
  divergence: "Divergence",
  trend_detection: "Trend Detection",
}

export function PerformanceTechniques({ stats }: Props) {
  const techniques = useMemo(() => {
    return stats
      .filter((s) => s.technique != null)
      .sort((a, b) => {
        // Sort by win rate desc, then profit factor desc
        if (b.winRate !== a.winRate) return b.winRate - a.winRate
        return b.profitFactor - a.profitFactor
      })
  }, [stats])

  if (techniques.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">No technique data yet.</div>
    )
  }

  const maxTrades = Math.max(...techniques.map((t) => t.totalTrades), 1)

  return (
    <section aria-label="Performance by analysis technique">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        By Technique
      </h3>
      <div className="space-y-2">
        {techniques.map((t, i) => {
          const label = TECHNIQUE_LABELS[t.technique!] ?? t.technique!
          const winPct = Math.round(t.winRate * 100)
          const barWidth = (t.totalTrades / maxTrades) * 100
          return (
            <div key={t.technique} className="bg-card rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                    #{i + 1}
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-muted-foreground">{t.totalTrades} trades</span>
                  <span
                    className={cn(
                      "font-semibold",
                      winPct >= 60
                        ? "text-green-600 dark:text-green-400"
                        : winPct >= 40
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {winPct}% win
                  </span>
                  <span
                    className={cn(
                      t.totalPL >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {t.totalPL >= 0 ? "+" : ""}${t.totalPL.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    winPct >= 60 ? "bg-green-500" : winPct >= 40 ? "bg-amber-500" : "bg-red-500",
                  )}
                  style={{ width: `${barWidth}%` }}
                  role="meter"
                  aria-valuenow={t.totalTrades}
                  aria-valuemax={maxTrades}
                  aria-label={`${label}: ${t.totalTrades} trades`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
