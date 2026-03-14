"use client"

import { cn } from "@/lib/utils"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import { TrendingDown } from "lucide-react"
import type { DrawdownData } from "@/app/api/risk/drawdown/route"

interface DrawdownTrackerProps {
  drawdown: DrawdownData | null
  loading: boolean
  currency: string
}

export function DrawdownTracker({ drawdown, loading, currency }: DrawdownTrackerProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)

  if (loading) {
    return (
      <SectionCard icon={TrendingDown} title="Drawdown Tracker">
        <div className="flex h-24 items-center justify-center">
          <p className="text-muted-foreground text-xs">Loading drawdown data...</p>
        </div>
      </SectionCard>
    )
  }

  if (!drawdown) {
    return (
      <SectionCard icon={TrendingDown} title="Drawdown Tracker">
        <p className="text-muted-foreground py-4 text-center text-xs">
          No closed trades yet to calculate drawdown
        </p>
      </SectionCard>
    )
  }

  const currentPct = drawdown.currentDrawdown
  const maxPct = drawdown.maxDrawdown
  const barWidth = maxPct > 0 ? Math.min((currentPct / Math.max(maxPct, 1)) * 100, 100) : 0

  return (
    <SectionCard icon={TrendingDown} title="Drawdown Tracker">
      <div className="space-y-3">
        {/* Current drawdown headline */}
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-2xl font-bold tabular-nums",
              currentPct > 10
                ? "text-red-500"
                : currentPct > 5
                  ? "text-amber-500"
                  : "text-foreground",
            )}
          >
            {currentPct.toFixed(1)}%
          </span>
          <span className="text-muted-foreground text-xs">current drawdown</span>
        </div>

        {/* Progress bar: current vs max */}
        <div className="space-y-1">
          <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                currentPct > 10 ? "bg-red-500" : currentPct > 5 ? "bg-amber-500" : "bg-blue-500",
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>0%</span>
            <span>Max: {maxPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Detail rows */}
        <div className="space-y-0.5">
          <DetailRow label="Current Drawdown" value={fmt(drawdown.currentDrawdownAmount)} />
          <DetailRow label="Max Drawdown" value={fmt(drawdown.maxDrawdownAmount)} />
          <DetailRow label="Peak Equity (P&L)" value={fmt(drawdown.peakEquity)} />
          <DetailRow label="Current Equity (P&L)" value={fmt(drawdown.currentEquity)} />
          {drawdown.drawdownDuration > 0 && (
            <DetailRow
              label="Days Since Peak"
              value={`${drawdown.drawdownDuration}d`}
              className={drawdown.drawdownDuration > 30 ? "text-red-500" : undefined}
            />
          )}
        </div>
      </div>
    </SectionCard>
  )
}
