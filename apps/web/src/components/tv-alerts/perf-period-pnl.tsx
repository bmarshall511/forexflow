"use client"

import { cn } from "@/lib/utils"
import type { TVSignalPeriodPnLData, PnLPeriod } from "@fxflow/types"

interface PerfPeriodPnlProps {
  periodPnl: TVSignalPeriodPnLData | null
}

const PERIOD_ORDER: Exclude<PnLPeriod, "allTime">[] = [
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "thisYear",
]

const PERIOD_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  thisMonth: "This Month",
  thisYear: "This Year",
}

export function PerfPeriodPnl({ periodPnl }: PerfPeriodPnlProps) {
  if (!periodPnl) return null

  return (
    <div
      className="grid grid-cols-2 gap-2 md:grid-cols-5"
      role="region"
      aria-label="Period profit and loss"
    >
      {PERIOD_ORDER.map((period) => {
        const data = periodPnl[period]
        if (!data) return null

        const isPositive = data.net >= 0

        return (
          <div
            key={period}
            className={cn(
              "border-border/50 bg-card rounded-xl border border-l-2 p-3",
              isPositive ? "border-l-status-connected" : "border-l-status-disconnected",
            )}
          >
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              {PERIOD_LABELS[period]}
            </span>

            <p
              className={cn(
                "mt-1 font-mono text-sm font-semibold tabular-nums",
                isPositive ? "text-status-connected" : "text-status-disconnected",
              )}
            >
              {isPositive ? "+" : ""}${data.net.toFixed(2)}
            </p>

            <p className="mt-0.5 text-[10px]">
              <span className="text-status-connected">{data.wins}W</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-status-disconnected">{data.losses}L</span>
            </p>
          </div>
        )
      })}
    </div>
  )
}
