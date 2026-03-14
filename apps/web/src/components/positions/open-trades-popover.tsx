"use client"

import type { OpenTradeData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { DirectionBadge } from "./direction-badge"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface OpenTradesPopoverProps {
  trades: OpenTradeData[]
  currency?: string
}

export function OpenTradesPopover({ trades, currency = "USD" }: OpenTradesPopoverProps) {
  if (trades.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Open Trades</h4>
        <p className="text-muted-foreground text-xs">No open trades</p>
      </div>
    )
  }

  // Sort worst P/L first, take top 5
  const sorted = [...trades].sort((a, b) => a.unrealizedPL - b.unrealizedPL).slice(0, 5)

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Open Trades</h4>

      <div className="space-y-2">
        {sorted.map((trade) => {
          const plColor =
            trade.unrealizedPL >= 0 ? "text-status-connected" : "text-status-disconnected"
          return (
            <div key={trade.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-medium">
                  {trade.instrument.replace("_", "/")}
                </span>
                <DirectionBadge direction={trade.direction} />
              </div>
              <span
                className={cn("shrink-0 font-mono text-xs font-semibold tabular-nums", plColor)}
              >
                {formatCurrency(trade.unrealizedPL, currency)}
              </span>
            </div>
          )
        })}
      </div>

      <Link
        href="/positions?tab=open"
        className="text-primary border-border block border-t pt-1 text-xs hover:underline"
      >
        View all {trades.length} open &rarr;
      </Link>
    </div>
  )
}
