"use client"

import type { OpenTradeData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { OpenProgressBar } from "@/components/positions/progress-bar-open"
import { ProximityTradeRow } from "./proximity-trade-row"
import type { ProximityTrade } from "./use-positions-dashboard"
import Link from "next/link"

interface ProximityClosingSectionProps {
  trades: ProximityTrade[]
  currency: string
  onSelectTrade: (trade: OpenTradeData) => void
}

export function ProximityClosingSection({
  trades,
  currency,
  onSelectTrade,
}: ProximityClosingSectionProps) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Near Closing
        </h3>
        {trades.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {trades.length}
          </Badge>
        )}
      </div>

      {trades.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          No trades near closing threshold
        </p>
      ) : (
        <div className="space-y-0.5">
          {trades.map((item) => {
            const { trade, proximityType } = item
            const isNearSL = proximityType === "sl"
            const pair = trade.instrument.replace("_", "/")

            return (
              <ProximityTradeRow
                key={trade.id}
                instrument={trade.instrument}
                direction={trade.direction}
                value={formatCurrency(trade.unrealizedPL, currency)}
                valueClassName={cn(
                  trade.unrealizedPL >= 0
                    ? "text-status-connected"
                    : "text-status-disconnected",
                )}
                detail={isNearSL ? "Near SL" : "Near TP"}
                detailClassName={cn(
                  isNearSL ? "text-status-disconnected" : "text-status-connected",
                )}
                onClick={() => onSelectTrade(trade)}
                ariaLabel={`View ${pair} ${trade.direction} trade details — ${isNearSL ? "near stop loss" : "near take profit"}`}
              >
                <OpenProgressBar
                  instrument={trade.instrument}
                  direction={trade.direction}
                  entryPrice={trade.entryPrice}
                  currentPrice={trade.currentPrice}
                  stopLoss={trade.stopLoss}
                  takeProfit={trade.takeProfit}
                  className="mt-0.5"
                />
              </ProximityTradeRow>
            )
          })}

          <Link
            href="/positions?tab=open"
            className="mt-1 block text-center text-[10px] font-medium text-primary hover:underline"
            aria-label="View all open trades"
          >
            View all open trades
          </Link>
        </div>
      )}
    </div>
  )
}
