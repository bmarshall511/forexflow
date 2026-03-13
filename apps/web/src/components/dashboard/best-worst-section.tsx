"use client"

import type { OpenTradeData } from "@fxflow/types"
import { formatCurrency, getDecimalPlaces, priceToPips, formatPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { TrendingUp, TrendingDown } from "lucide-react"

interface BestWorstSectionProps {
  best: OpenTradeData | null
  worst: OpenTradeData | null
  currency: string
  onSelectTrade: (trade: OpenTradeData) => void
}

export function BestWorstSection({
  best,
  worst,
  currency,
  onSelectTrade,
}: BestWorstSectionProps) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Performers
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PerformerCard
          label="Best"
          icon={TrendingUp}
          trade={best}
          currency={currency}
          colorClassName="text-status-connected"
          bgClassName="bg-status-connected/8"
          variant="positive"
          onSelect={onSelectTrade}
        />
        <PerformerCard
          label="Worst"
          icon={TrendingDown}
          trade={worst}
          currency={currency}
          colorClassName="text-status-disconnected"
          bgClassName="bg-status-disconnected/8"
          variant="negative"
          onSelect={onSelectTrade}
        />
      </div>
    </div>
  )
}

function PerformerCard({
  label,
  icon: Icon,
  trade,
  currency,
  colorClassName,
  bgClassName,
  variant,
  onSelect,
}: {
  label: string
  icon: React.ElementType
  trade: OpenTradeData | null
  currency: string
  colorClassName: string
  bgClassName: string
  variant: "positive" | "negative"
  onSelect: (trade: OpenTradeData) => void
}) {
  if (!trade) {
    return (
      <div className="rounded-lg bg-muted/50 px-3 py-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3" />
          {label}
        </div>
        <span className="mt-1.5 block text-sm text-muted-foreground">—</span>
      </div>
    )
  }

  const pair = trade.instrument.replace("_", "/")
  const decimals = getDecimalPlaces(trade.instrument)
  const accentBorder = variant === "positive"
    ? "border-l-2 border-l-status-connected"
    : "border-l-2 border-l-status-disconnected"

  const isProfit = trade.unrealizedPL >= 0
  const pipDistance = trade.currentPrice
    ? priceToPips(trade.instrument, Math.abs(trade.currentPrice - trade.entryPrice))
    : null

  return (
    <button
      type="button"
      onClick={() => onSelect(trade)}
      aria-label={`View ${pair} ${trade.direction} trade — ${label.toLowerCase()} performer`}
      className={cn(
        "rounded-lg px-3 py-3 text-left transition-colors",
        bgClassName,
        accentBorder,
        "hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Header: label + pair + direction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3" />
          {label}
        </div>
        <DirectionBadge direction={trade.direction} />
      </div>
      <span className="mt-1 block text-xs font-medium">{pair}</span>

      {/* P&L amount */}
      <AnimatedNumber
        value={formatCurrency(trade.unrealizedPL, currency)}
        className={cn("mt-1.5 block text-sm font-semibold font-mono tabular-nums", colorClassName)}
      />

      {/* Price context with labels */}
      <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground tabular-nums">
        <div>Entry: {trade.entryPrice.toFixed(decimals)}</div>
        {trade.currentPrice && (
          <div>
            <span>Now: {trade.currentPrice.toFixed(decimals)}</span>
            {pipDistance !== null && (
              <span className={cn("ml-1.5 font-medium", isProfit ? "text-status-connected" : "text-status-disconnected")}>
                ({isProfit ? "up" : "down"} {formatPips(pipDistance)} pips)
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
