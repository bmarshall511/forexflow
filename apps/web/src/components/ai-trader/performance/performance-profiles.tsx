"use client"

import { useMemo } from "react"
import type { AiTraderStrategyPerformanceData, AiTraderProfile } from "@fxflow/types"
import { DonutChart, InlineStat } from "@/components/ui/data-tile"
import { cn } from "@/lib/utils"

interface Props {
  stats: AiTraderStrategyPerformanceData[]
}

const PROFILE_META: Record<AiTraderProfile, { label: string; color: string }> = {
  scalper: { label: "Scalper", color: "border-l-rose-500" },
  intraday: { label: "Intraday", color: "border-l-blue-500" },
  swing: { label: "Swing", color: "border-l-amber-500" },
  news: { label: "News", color: "border-l-violet-500" },
}

function fmt(v: number): string {
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`
}

export function PerformanceProfiles({ stats }: Props) {
  const profiles = useMemo(() => {
    // Get overall stats per profile (instrument=null, session=null, technique=null)
    return stats.filter((s) => s.instrument == null && s.session == null && s.technique == null)
  }, [stats])

  if (profiles.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">No profile data yet.</div>
    )
  }

  return (
    <section aria-label="Performance by strategy profile">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        By Profile
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {profiles.map((p) => {
          const meta = PROFILE_META[p.profile] ?? {
            label: p.profile,
            color: "border-l-gray-500",
          }
          return (
            <div
              key={p.profile}
              className={cn("bg-card space-y-3 rounded-lg border border-l-2 p-4", meta.color)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{meta.label}</span>
                <DonutChart value={p.winRate * 100} size={40} strokeWidth={3} />
              </div>
              <div className="divide-border/50 divide-y">
                <InlineStat label="Trades" value={p.totalTrades} />
                <InlineStat
                  label="W / L / BE"
                  value={`${p.wins} / ${p.losses} / ${p.breakevens}`}
                />
                <InlineStat
                  label="P&L"
                  value={fmt(p.totalPL)}
                  className={
                    p.totalPL >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                />
                <InlineStat label="Profit Factor" value={p.profitFactor.toFixed(2)} />
                <InlineStat label="Avg R:R" value={`1:${p.avgRR.toFixed(1)}`} />
                <InlineStat
                  label="Expectancy"
                  value={`$${p.expectancy.toFixed(2)}`}
                  className={
                    p.expectancy >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
