"use client"

import { useMemo } from "react"
import type { AiTraderStrategyPerformanceData, SessionPerformance } from "@fxflow/types"
import { SessionChart } from "@/components/analytics/session-chart"

interface Props {
  stats: AiTraderStrategyPerformanceData[]
}

const SESSION_LABELS: Record<string, string> = {
  asian: "Asian",
  london: "London",
  ny: "New York",
  sydney: "Sydney",
  overlap: "Overlap",
}

export function PerformanceSessions({ stats }: Props) {
  const data = useMemo<SessionPerformance[]>(() => {
    return stats
      .filter((s) => s.session != null)
      .map((s) => ({
        session: SESSION_LABELS[s.session!] ?? s.session!,
        trades: s.totalTrades,
        wins: s.wins,
        winRate: s.winRate,
        totalPL: s.totalPL,
        profitFactor: s.profitFactor,
      }))
  }, [stats])

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">No session data yet.</div>
    )
  }

  return (
    <section aria-label="Performance by trading session">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        By Session
      </h3>
      <SessionChart data={data} />
    </section>
  )
}
