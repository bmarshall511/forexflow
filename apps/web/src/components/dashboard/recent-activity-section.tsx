"use client"

import type { ClosedTradeData } from "@fxflow/types"
import { formatCurrency, formatRelativeTime } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { OutcomeBadge } from "@/components/positions/outcome-badge"
import { ProximityTradeRow } from "./proximity-trade-row"
import Link from "next/link"

interface RecentActivitySectionProps {
  trades: ClosedTradeData[]
  currency: string
  onSelectTrade: (trade: ClosedTradeData) => void
}

export function RecentActivitySection({
  trades,
  currency,
  onSelectTrade,
}: RecentActivitySectionProps) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-[11px] font-medium uppercase tracking-wider">
        Recent Activity
      </h3>

      {trades.length === 0 ? (
        <p className="text-muted-foreground py-3 text-center text-xs">No trades closed today</p>
      ) : (
        <div className="space-y-0.5">
          {trades.map((trade) => {
            const pair = trade.instrument.replace("_", "/")

            return (
              <ProximityTradeRow
                key={trade.id}
                instrument={trade.instrument}
                direction={trade.direction}
                value={formatCurrency(trade.realizedPL, currency)}
                valueClassName={cn(
                  trade.realizedPL >= 0 ? "text-status-connected" : "text-status-disconnected",
                )}
                detail={formatRelativeTime(trade.closedAt)}
                detailClassName="text-muted-foreground"
                onClick={() => onSelectTrade(trade)}
                ariaLabel={`View ${pair} ${trade.direction} closed trade — ${trade.outcome}`}
              >
                <OutcomeBadge
                  outcome={trade.outcome}
                  closeReason={trade.closeReason}
                  className="w-fit"
                />
              </ProximityTradeRow>
            )
          })}

          <Link
            href="/positions?tab=history"
            className="text-primary mt-1 block text-center text-[10px] font-medium hover:underline"
            aria-label="View all trade history"
          >
            View full history
          </Link>
        </div>
      )}
    </div>
  )
}
