"use client"

import type { ClosedTradeData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { DirectionBadge } from "./direction-badge"
import { OutcomeBadge } from "./outcome-badge"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ClosedTradesPopoverProps {
  trades: ClosedTradeData[]
  currency?: string
}

export function ClosedTradesPopover({ trades, currency = "USD" }: ClosedTradesPopoverProps) {
  if (trades.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Closed Today</h4>
        <p className="text-xs text-muted-foreground">No trades closed today</p>
      </div>
    )
  }

  const wins = trades.filter((t) => t.outcome === "win").length
  const losses = trades.filter((t) => t.outcome === "loss").length
  const netPL = trades.reduce((s, t) => s + t.realizedPL + t.financing, 0)
  const winRate = ((wins / trades.length) * 100).toFixed(0)
  const recent = trades.slice(0, 5)

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Closed Today</h4>

      {/* Summary banner */}
      <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
        <span className="font-medium">{wins}W / {losses}L</span>
        <span className="text-muted-foreground"> · {winRate}% WR · </span>
        <span className={cn("font-semibold font-mono tabular-nums", netPL >= 0 ? "text-status-connected" : "text-status-disconnected")}>
          {netPL >= 0 ? "+" : ""}{formatCurrency(netPL, currency)}
        </span>
      </div>

      {/* Recent trades */}
      <div className="space-y-2">
        {recent.map((trade) => {
          const plColor = trade.realizedPL >= 0 ? "text-status-connected" : "text-status-disconnected"
          return (
            <div key={trade.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium truncate">
                  {trade.instrument.replace("_", "/")}
                </span>
                <DirectionBadge direction={trade.direction} />
                <OutcomeBadge outcome={trade.outcome} />
              </div>
              <span className={cn("text-xs font-mono tabular-nums font-semibold shrink-0", plColor)}>
                {formatCurrency(trade.realizedPL, currency)}
              </span>
            </div>
          )
        })}
      </div>

      <Link
        href="/positions?tab=history"
        className="block text-xs text-primary hover:underline pt-1 border-t border-border"
      >
        View all history &rarr;
      </Link>
    </div>
  )
}
