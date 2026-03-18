"use client"

import type { ReplayCandle, ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"
import { getPipSize } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface ReplayCandleInfoProps {
  candle: ReplayCandle | null
  trade: ReplayTradeInfo
  hasEnteredTrade: boolean
}

export function ReplayCandleInfo({ candle, trade, hasEnteredTrade }: ReplayCandleInfoProps) {
  if (!candle) return null

  const pip = getPipSize(trade.instrument)
  const decimals = pip < 0.001 ? 5 : pip < 0.01 ? 4 : 3
  const isLong = trade.direction === "long"

  // Unrealized P&L in pips at this candle's close
  let unrealizedPips: number | null = null
  if (hasEnteredTrade) {
    unrealizedPips = isLong
      ? (candle.close - trade.entryPrice) / pip
      : (trade.entryPrice - candle.close) / pip
  }

  const isUp = candle.close >= candle.open

  return (
    <div className="flex items-center gap-4 text-[11px]">
      {/* OHLC display */}
      <div className="flex items-center gap-2 font-mono">
        <span className="text-muted-foreground">O</span>
        <span className="font-medium">{candle.open.toFixed(decimals)}</span>
        <span className="text-muted-foreground">H</span>
        <span className="font-medium">{candle.high.toFixed(decimals)}</span>
        <span className="text-muted-foreground">L</span>
        <span className="font-medium">{candle.low.toFixed(decimals)}</span>
        <span className="text-muted-foreground">C</span>
        <span className={cn("font-medium", isUp ? "text-emerald-500" : "text-red-500")}>
          {candle.close.toFixed(decimals)}
        </span>
      </div>

      {/* Live unrealized pips while inside the trade */}
      {unrealizedPips !== null && (
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-bold",
            unrealizedPips >= 0
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-red-500/10 text-red-500",
          )}
          aria-label={`${unrealizedPips >= 0 ? "Up" : "Down"} ${Math.abs(unrealizedPips).toFixed(1)} pips`}
        >
          <span>
            {unrealizedPips >= 0 ? "+" : ""}
            {unrealizedPips.toFixed(1)} pips
          </span>
        </div>
      )}
    </div>
  )
}
