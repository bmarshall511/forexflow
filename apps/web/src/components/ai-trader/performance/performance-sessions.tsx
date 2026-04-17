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
  london_ny_overlap: "London/NY Overlap",
  london_close: "London Close",
  off_session: "Off Session",
}

export function PerformanceSessions({ stats }: Props) {
  const data = useMemo<SessionPerformance[]>(() => {
    // Aggregate by session to avoid duplicate keys when multiple
    // profile/instrument rows share the same session value
    const bySession = new Map<
      string,
      { trades: number; wins: number; totalPL: number; grossProfit: number; grossLoss: number }
    >()
    for (const s of stats) {
      if (s.session == null) continue
      const key = s.session
      const agg = bySession.get(key) ?? {
        trades: 0,
        wins: 0,
        totalPL: 0,
        grossProfit: 0,
        grossLoss: 0,
      }
      agg.trades += s.totalTrades
      agg.wins += s.wins
      agg.totalPL += s.totalPL
      if (s.totalPL > 0) agg.grossProfit += s.totalPL
      else agg.grossLoss += Math.abs(s.totalPL)
      bySession.set(key, agg)
    }

    return Array.from(bySession.entries()).map(([session, agg]) => ({
      session: SESSION_LABELS[session] ?? session.replace(/_/g, " "),
      trades: agg.trades,
      wins: agg.wins,
      winRate: agg.trades > 0 ? agg.wins / agg.trades : 0,
      totalPL: agg.totalPL,
      profitFactor:
        agg.grossLoss > 0 ? agg.grossProfit / agg.grossLoss : agg.grossProfit > 0 ? 99 : 0,
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
