"use client"

import type { PendingOrderData, OpenTradeData, ClosedTradeData } from "@fxflow/types"
import { formatCurrency, formatPips, getDecimalPlaces, formatShortDateTime, calculateRiskReward, getPipSize, TIMEFRAME_OPTIONS } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { SourceBadge } from "./source-badge"
import { OutcomeBadge } from "./outcome-badge"
import { TagBadges } from "./tag-badges"
import { PendingProgressBar } from "./progress-bar-pending"
import { OpenProgressBar } from "./progress-bar-open"
import { DurationDisplay } from "./duration-display"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreVertical, Eye, XCircle,
  Target, ShieldAlert, DollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TradeCardVariant = "pending" | "open" | "closed"

interface TradeCardMobileProps {
  variant: TradeCardVariant
  data: PendingOrderData | OpenTradeData | ClosedTradeData
  currentPrice?: number | null
  currency?: string
  onViewDetails?: () => void
  onCancelOrder?: () => void
  onCloseTrade?: () => void
}

function fmtDollar(amount: number): string {
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${Math.abs(amount).toFixed(2)}`
}

function computeDollarAmount(units: number, pips: number, instrument: string): number {
  const pipSize = getPipSize(instrument)
  return Math.abs(units) * pips * pipSize
}

export function TradeCardMobile({
  variant,
  data,
  currentPrice,
  currency = "USD",
  onViewDetails,
  onCancelOrder,
  onCloseTrade,
}: TradeCardMobileProps) {
  const pair = data.instrument.replace("_", "/")
  const decimals = getDecimalPlaces(data.instrument)
  const isPending = variant === "pending"
  const isOpen = variant === "open"
  const isClosed = variant === "closed"
  const isLong = data.direction === "long"

  const entryPrice = isPending
    ? (data as PendingOrderData).entryPrice
    : isOpen
      ? (data as OpenTradeData).entryPrice
      : (data as ClosedTradeData).entryPrice

  const units = isPending
    ? (data as PendingOrderData).units
    : isOpen
      ? (data as OpenTradeData).currentUnits
      : (data as ClosedTradeData).units

  // P/L
  const plValue = isOpen
    ? (data as OpenTradeData).unrealizedPL
    : isClosed
      ? (data as ClosedTradeData).realizedPL
      : null
  const isPositive = plValue !== null && plValue >= 0.005
  const isNegative = plValue !== null && plValue <= -0.005
  const plColor = isPositive
    ? "text-green-500"
    : isNegative
      ? "text-red-500"
      : "text-muted-foreground"

  // Risk / Reward
  const rr = calculateRiskReward(data.direction, entryPrice, data.stopLoss ?? null, data.takeProfit ?? null, data.instrument)
  const riskDollars = rr.riskPips !== null ? computeDollarAmount(units, rr.riskPips, data.instrument) : null
  const rewardDollars = rr.rewardPips !== null ? computeDollarAmount(units, rr.rewardPips, data.instrument) : null

  const accentColor = isLong ? "border-l-green-500" : "border-l-red-500"

  return (
    <div className={cn(
      "rounded-xl border border-border/60 bg-card overflow-hidden border-l-[3px] p-4 space-y-3",
      accentColor,
    )}>
      {/* Header: pair + direction + P/L + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight">{pair}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 font-semibold border-0",
                isLong ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500",
              )}
            >
              {isLong ? "BUY" : "SELL"}
            </Badge>
            {isClosed && (
              <OutcomeBadge
                outcome={(data as ClosedTradeData).outcome}
                closeReason={(data as ClosedTradeData).closeReason}
              />
            )}
            {isPending && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/20">
                {(data as PendingOrderData).orderType}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <SourceBadge source={data.source} />
            {rr.ratio && <span>{rr.ratio} R:R</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* P/L */}
          {plValue !== null && (
            <div className="text-right">
              <div className={cn("text-lg font-bold font-mono tabular-nums", plColor)}>
                {isPositive ? "+" : ""}{formatCurrency(plValue, currency)}
              </div>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-7 p-0 shrink-0">
                <MoreVertical className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onViewDetails && (
                <DropdownMenuItem onClick={onViewDetails}>
                  <Eye className="size-4" />
                  View Details
                </DropdownMenuItem>
              )}
              {(isPending || isOpen) && (onCancelOrder || onCloseTrade) && (
                <DropdownMenuSeparator />
              )}
              {isPending && onCancelOrder && (
                <DropdownMenuItem variant="destructive" onClick={onCancelOrder}>
                  <XCircle className="size-4" />
                  Cancel Order
                </DropdownMenuItem>
              )}
              {isOpen && onCloseTrade && (
                <DropdownMenuItem variant="destructive" onClick={onCloseTrade}>
                  <XCircle className="size-4" />
                  Close Trade
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Risk / Reward bar */}
      {(riskDollars !== null || rewardDollars !== null) && (
        <div className="space-y-1">
          <div className="flex gap-0.5 h-5 rounded-lg overflow-hidden">
            {riskDollars !== null && (
              <div
                className="bg-red-500/15 flex items-center justify-center text-[10px] text-red-500 font-semibold rounded-l-lg"
                style={{
                  width: rr.riskPips !== null && rr.rewardPips !== null
                    ? `${Math.max(25, Math.min(50, (rr.riskPips / (rr.riskPips + rr.rewardPips)) * 100))}%`
                    : "40%",
                }}
              >
                -{fmtDollar(riskDollars)}
              </div>
            )}
            {rewardDollars !== null && (
              <div className="bg-green-500/15 flex items-center justify-center text-[10px] text-green-500 font-semibold flex-1 rounded-r-lg">
                +{fmtDollar(rewardDollars)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Price cards */}
      <div className="grid grid-cols-3 gap-2">
        <PriceBox
          icon={<Target className="size-3 text-amber-500" />}
          label="Entry"
          value={entryPrice.toFixed(decimals)}
          color="text-amber-500"
        />
        <PriceBox
          icon={<ShieldAlert className="size-3 text-red-500" />}
          label="Stop"
          value={data.stopLoss ? data.stopLoss.toFixed(decimals) : "None"}
          color="text-red-500"
        />
        <PriceBox
          icon={<DollarSign className="size-3 text-green-500" />}
          label="Target"
          value={data.takeProfit ? data.takeProfit.toFixed(decimals) : "None"}
          color="text-green-500"
        />
      </div>

      {/* Progress bars */}
      {isPending && (
        <PendingProgressBar
          instrument={data.instrument}
          entryPrice={(data as PendingOrderData).entryPrice}
          currentPrice={currentPrice ?? null}
        />
      )}
      {isOpen && (
        <OpenProgressBar
          instrument={data.instrument}
          direction={data.direction}
          entryPrice={(data as OpenTradeData).entryPrice}
          currentPrice={(data as OpenTradeData).currentPrice}
          stopLoss={data.stopLoss ?? null}
          takeProfit={data.takeProfit ?? null}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {isOpen && (
            <DurationDisplay openedAt={(data as OpenTradeData).openedAt} className="inline text-[11px]" />
          )}
          {isClosed && (
            <DurationDisplay
              openedAt={(data as ClosedTradeData).openedAt}
              closedAt={(data as ClosedTradeData).closedAt}
              className="inline text-[11px]"
            />
          )}
          {isPending && (
            <span>{formatShortDateTime(new Date((data as PendingOrderData).createdAt))}</span>
          )}
        </div>
        <TagBadges tags={data.tags} maxVisible={2} />
      </div>
    </div>
  )
}

function PriceBox({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  const isUnset = value === "None" || value === "—"
  return (
    <div className={cn(
      "rounded-lg border p-1.5 text-center",
      isUnset ? "border-dashed border-border/40 bg-muted/20" : "bg-muted/30",
    )}>
      <div className={cn("flex items-center justify-center gap-1 mb-0.5", color)}>
        {icon}
        <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn(
        "text-xs font-mono tabular-nums font-bold",
        isUnset ? "text-muted-foreground/50" : color,
      )}>
        {value}
      </div>
    </div>
  )
}
