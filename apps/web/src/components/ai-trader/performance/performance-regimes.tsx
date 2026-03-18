"use client"

import type { AiTraderRegimeStat } from "@fxflow/db"
import { cn } from "@/lib/utils"

interface Props {
  data: AiTraderRegimeStat[]
}

const REGIME_LABELS: Record<string, string> = {
  trending: "Trending",
  ranging: "Ranging",
  volatile: "Volatile",
  low_volatility: "Low Volatility",
}

const REGIME_COLORS: Record<string, string> = {
  trending: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  ranging: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  volatile: "bg-red-500/20 text-red-600 dark:text-red-400",
  low_volatility: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
}

export function PerformanceRegimes({ data }: Props) {
  if (data.length === 0) {
    return <div className="text-muted-foreground py-8 text-center text-sm">No regime data yet.</div>
  }

  return (
    <section aria-label="Performance by market regime">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        By Regime
      </h3>
      <div className="space-y-2">
        {data.map((r) => (
          <div
            key={r.regime}
            className="bg-card flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  REGIME_COLORS[r.regime] ?? "bg-muted text-muted-foreground",
                )}
              >
                {REGIME_LABELS[r.regime] ?? r.regime}
              </span>
              <span className="text-muted-foreground text-xs">
                {r.count} trade{r.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs tabular-nums">
              <span>
                WR: <strong>{(r.winRate * 100).toFixed(0)}%</strong>
              </span>
              <span>
                W/L: {r.wins}/{r.losses}
              </span>
              <span className={r.totalPL >= 0 ? "text-emerald-500" : "text-red-500"}>
                {r.totalPL >= 0 ? "+" : ""}${r.totalPL.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
