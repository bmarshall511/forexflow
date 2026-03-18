"use client"

import { useMemo } from "react"
import type { AiTraderStrategyPerformanceData, InstrumentPerformance } from "@fxflow/types"
import { InstrumentTable } from "@/components/analytics/instrument-table"

interface Props {
  stats: AiTraderStrategyPerformanceData[]
}

export function PerformanceInstruments({ stats }: Props) {
  const data = useMemo<InstrumentPerformance[]>(() => {
    return stats
      .filter((s) => s.instrument != null)
      .map((s) => ({
        instrument: s.instrument!,
        trades: s.totalTrades,
        wins: s.wins,
        losses: s.losses,
        winRate: s.winRate,
        totalPL: s.totalPL,
        avgPL: s.totalTrades > 0 ? s.totalPL / s.totalTrades : 0,
        profitFactor: s.profitFactor,
      }))
  }, [stats])

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No per-instrument data yet.
      </div>
    )
  }

  return (
    <section aria-label="Performance by instrument">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        By Instrument
      </h3>
      <InstrumentTable data={data} />
    </section>
  )
}
