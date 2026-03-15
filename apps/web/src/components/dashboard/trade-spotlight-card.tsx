"use client"

import { useMemo } from "react"
import { formatPnL, priceToPips } from "@fxflow/shared"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { TradeHealthBar } from "@/components/ui/trade-health-bar"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { cn } from "@/lib/utils"
import { X, Clock } from "lucide-react"
import type { OpenTradeData } from "@fxflow/types"

interface TradeSpotlightCardProps {
  trade: OpenTradeData
  progressPercent: number | null
  proximityLabel: string | null
  currency: string
  onClose?: () => void
  onSelect?: () => void
}

function formatDuration(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rem = minutes % 60
    return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export function TradeSpotlightCard({
  trade,
  progressPercent,
  proximityLabel,
  currency,
  onClose,
  onSelect,
}: TradeSpotlightCardProps) {
  const pair = trade.instrument.replace("_", "/")
  const pnl = formatPnL(trade.unrealizedPL, currency)

  const pipsMove = useMemo(() => {
    if (!trade.currentPrice) return null
    const raw = priceToPips(trade.instrument, trade.currentPrice - trade.entryPrice)
    const pips = trade.direction === "long" ? raw : -raw
    return pips.toFixed(1)
  }, [trade])

  return (
    <div
      className={cn(
        "border-border/50 bg-card group relative flex flex-col gap-2 rounded-xl border p-3 transition-all",
        "hover:border-border hover:shadow-md",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      {/* Header: instrument + direction + P&L */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
          aria-label={`View details for ${pair}`}
        >
          <span className="text-sm font-semibold">{pair}</span>
          <DirectionBadge direction={trade.direction} />
          {proximityLabel && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                proximityLabel.includes("TP")
                  ? "bg-status-connected/10 text-status-connected"
                  : "bg-status-disconnected/10 text-status-disconnected",
              )}
            >
              {proximityLabel}
            </span>
          )}
        </button>

        <AnimatedNumber
          value={pnl.formatted}
          className={cn(
            "font-mono text-base font-bold tabular-nums",
            pnl.colorIntent === "positive"
              ? "text-status-connected"
              : pnl.colorIntent === "negative"
                ? "text-status-disconnected"
                : "text-muted-foreground",
          )}
        />
      </div>

      {/* Health bar */}
      {progressPercent !== null && (
        <TradeHealthBar
          progressPercent={progressPercent}
          hasSL={trade.stopLoss !== null}
          hasTP={trade.takeProfit !== null}
        />
      )}

      {/* Footer: entry, pips, duration, close button */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-muted-foreground tabular-nums">
          Entry {trade.entryPrice.toFixed(trade.instrument.includes("JPY") ? 3 : 5)}
          {trade.currentPrice && (
            <> → {trade.currentPrice.toFixed(trade.instrument.includes("JPY") ? 3 : 5)}</>
          )}
        </span>
        {pipsMove && (
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              Number(pipsMove) >= 0 ? "text-status-connected" : "text-status-disconnected",
            )}
          >
            {Number(pipsMove) >= 0 ? "+" : ""}
            {pipsMove}p
          </span>
        )}
        <span className="text-muted-foreground/60 flex items-center gap-0.5">
          <Clock className="size-2.5" />
          {formatDuration(trade.openedAt)}
        </span>

        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className={cn(
              "ml-auto flex size-7 items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
            )}
            aria-label={`Close ${pair} trade`}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
