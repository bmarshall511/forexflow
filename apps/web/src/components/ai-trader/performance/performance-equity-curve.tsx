"use client"

import type { EquityCurvePoint } from "@fxflow/types"
import { EquityCurveChart } from "@/components/analytics/equity-curve-chart"

interface Props {
  data: EquityCurvePoint[]
}

export function PerformanceEquityCurve({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No closed trades yet to chart.
      </div>
    )
  }

  return (
    <section aria-label="AI Trader equity curve">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        Cumulative P&L
      </h3>
      <EquityCurveChart data={data} height={240} />
    </section>
  )
}
