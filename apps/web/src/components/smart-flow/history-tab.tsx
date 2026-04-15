"use client"

import { useState, useCallback } from "react"
import type { SmartFlowTradeData } from "@fxflow/types"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollText } from "lucide-react"
import { HistoryTradeCard } from "./history-trade-card"
import { TradeReviewDrawer } from "./trade-review-drawer"

interface HistoryTabProps {
  trades: SmartFlowTradeData[]
}

export function HistoryTab({ trades }: HistoryTabProps) {
  const [selected, setSelected] = useState<SmartFlowTradeData | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const handleSelect = useCallback((trade: SmartFlowTradeData) => {
    setSelected(trade)
    setDrawerOpen(true)
  }, [])
  const handleOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open)
    // Keep the selected trade around until the drawer finishes its close
    // animation so we don't flash empty content. Next selection replaces it.
  }, [])
  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="mx-auto max-w-sm space-y-3 text-center">
            <div className="bg-primary/10 mx-auto flex size-10 items-center justify-center rounded-full">
              <ScrollText className="text-primary size-5" />
            </div>
            <p className="text-foreground text-sm font-medium">No trade history yet</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Completed SmartFlow trades will appear here with details about how long they lasted,
              which protections fired, and the outcome.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Summary stats — win rate now uses realized P&L when available, falling
  // back to "no safety net triggered" for legacy rows without the Trade join.
  const total = trades.length
  const safetyNetCount = trades.filter((t) => t.safetyNetTriggered != null).length
  const wins = trades.filter((t) =>
    t.realizedPL != null ? t.realizedPL > 0 : t.safetyNetTriggered == null,
  ).length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const totalPL = trades.reduce((sum, t) => sum + (t.realizedPL ?? 0), 0)
  const hasPLData = trades.some((t) => t.realizedPL != null)
  const avgDuration =
    trades.reduce((sum, t) => {
      if (!t.closedAt || !t.createdAt) return sum
      return sum + (new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime()) / 3_600_000
    }, 0) / Math.max(total, 1)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-muted/50 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg px-4 py-2.5 text-xs">
        <span>
          <span className="text-foreground font-medium">{total}</span>{" "}
          <span className="text-muted-foreground">trades</span>
        </span>
        <span>
          <span className="font-medium text-emerald-500">{wins}</span>{" "}
          <span className="text-muted-foreground">wins</span>
        </span>
        <span>
          <span className="font-medium text-amber-500">{safetyNetCount}</span>{" "}
          <span className="text-muted-foreground">safety exits</span>
        </span>
        <span>
          <span className="text-foreground font-medium">{winRate}%</span>{" "}
          <span className="text-muted-foreground">win rate</span>
        </span>
        {hasPLData && (
          <span>
            <span
              className={
                totalPL > 0
                  ? "font-medium text-emerald-500"
                  : totalPL < 0
                    ? "font-medium text-red-500"
                    : "text-foreground font-medium"
              }
            >
              {totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}
            </span>{" "}
            <span className="text-muted-foreground">total P&L</span>
          </span>
        )}
        <span>
          <span className="text-foreground font-medium">{formatDuration(avgDuration)}</span>{" "}
          <span className="text-muted-foreground">avg duration</span>
        </span>
      </div>

      {/* Trade list */}
      <div className="divide-border divide-y rounded-lg border">
        {trades.map((trade) => (
          <HistoryTradeCard key={trade.id} trade={trade} onSelect={handleSelect} />
        ))}
      </div>

      <TradeReviewDrawer trade={selected} open={drawerOpen} onOpenChange={handleOpenChange} />
    </div>
  )
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${Math.round(hours / 24)}d`
}
