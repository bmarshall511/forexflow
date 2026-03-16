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
        <p className="text-muted-foreground text-xs">No trades closed today</p>
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
      <div className="bg-muted/50 rounded-md px-2.5 py-1.5 text-xs">
        <span className="font-medium">
          {wins}W / {losses}L
        </span>
        <span className="text-muted-foreground"> · {winRate}% WR · </span>
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            netPL >= 0 ? "text-status-connected" : "text-status-disconnected",
          )}
        >
          {netPL >= 0 ? "+" : ""}
          {formatCurrency(netPL, currency)}
        </span>
      </div>

      {/* Recent trades */}
      <div className="space-y-2">
        {recent.map((trade) => {
          const plColor =
            trade.realizedPL >= 0 ? "text-status-connected" : "text-status-disconnected"
          return (
            <div key={trade.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-medium">
                  {trade.instrument.replace("_", "/")}
                </span>
                <DirectionBadge direction={trade.direction} />
                <OutcomeBadge
                  outcome={trade.outcome}
                  closeReason={trade.closeReason}
                  closeContext={trade.closeContext}
                />
              </div>
              <span
                className={cn("shrink-0 font-mono text-xs font-semibold tabular-nums", plColor)}
              >
                {formatCurrency(trade.realizedPL, currency)}
              </span>
            </div>
          )
        })}
      </div>

      <Link
        href="/positions?tab=history"
        className="text-primary border-border block border-t pt-1 text-xs hover:underline"
      >
        View all history &rarr;
      </Link>
    </div>
  )
}
