"use client"

import type { ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"
import { formatInstrument, getPipSize } from "@fxflow/shared"
import { TrendingUp, TrendingDown, Clock, Target, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReplayTradeInfoProps {
  trade: ReplayTradeInfo
}

export function ReplayTradeInfoPanel({ trade }: ReplayTradeInfoProps) {
  const pair = formatInstrument(trade.instrument)
  const isWin = trade.realizedPL >= 0
  const isLong = trade.direction === "long"
  const pip = getPipSize(trade.instrument)
  const decimals = pip < 0.001 ? 5 : pip < 0.01 ? 4 : 3

  // Duration
  const durationMs =
    trade.closedAt && trade.openedAt
      ? new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()
      : 0
  const hours = durationMs / 3_600_000
  const durationStr =
    hours < 1
      ? `${Math.round(hours * 60)}m`
      : hours < 24
        ? `${hours.toFixed(1)}h`
        : `${Math.round(hours / 24)}d`

  // Pips gained/lost (directional)
  const pipsDiff = trade.exitPrice
    ? (isLong ? trade.exitPrice - trade.entryPrice : trade.entryPrice - trade.exitPrice) / pip
    : 0

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border px-4 py-2.5 text-xs",
        isWin ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5",
      )}
    >
      {/* Outcome */}
      <div className="flex items-center gap-1.5">
        {isWin ? (
          <TrendingUp className="size-4 text-emerald-500" aria-hidden="true" />
        ) : (
          <TrendingDown className="size-4 text-red-500" aria-hidden="true" />
        )}
        <span className={cn("font-bold", isWin ? "text-emerald-500" : "text-red-500")}>
          {isWin ? "Won" : "Lost"} {trade.realizedPL >= 0 ? "+" : ""}
          {trade.realizedPL.toFixed(2)}
        </span>
      </div>

      {/* Pair + Direction */}
      <div className="flex items-center gap-1.5">
        <span className="font-semibold">{pair}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
            isLong ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500",
          )}
        >
          {isLong ? "Buy" : "Sell"}
        </span>
      </div>

      {/* Pips */}
      <Stat
        label="Pips"
        value={`${pipsDiff >= 0 ? "+" : ""}${pipsDiff.toFixed(1)}`}
        color={pipsDiff >= 0 ? "text-emerald-500" : "text-red-500"}
      />

      {/* Entry → Exit */}
      <Stat label="Entry" value={trade.entryPrice.toFixed(decimals)} mono />
      {trade.exitPrice != null && (
        <Stat label="Exit" value={trade.exitPrice.toFixed(decimals)} mono />
      )}

      {/* Duration */}
      <Stat icon={Clock} label="Held" value={durationStr} />

      {/* SL/TP */}
      {trade.stopLoss != null && (
        <Stat icon={ShieldAlert} label="SL" value={trade.stopLoss.toFixed(decimals)} mono />
      )}
      {trade.takeProfit != null && (
        <Stat icon={Target} label="TP" value={trade.takeProfit.toFixed(decimals)} mono />
      )}

      {/* MFE/MAE */}
      {trade.mfe != null && (
        <Stat label="Best" value={`+${trade.mfe.toFixed(1)}p`} color="text-emerald-500" />
      )}
      {trade.mae != null && (
        <Stat label="Worst" value={`-${trade.mae.toFixed(1)}p`} color="text-red-400" />
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  mono,
}: {
  icon?: typeof Clock
  label: string
  value: string
  color?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {Icon && <Icon className="text-muted-foreground size-3" aria-hidden="true" />}
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", color, mono && "font-mono")}>{value}</span>
    </div>
  )
}
