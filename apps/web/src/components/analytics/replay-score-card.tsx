"use client"

import type { ReplayTradeInfo, ReplayCandle } from "@/app/api/trades/[tradeId]/replay-candles/route"
import { getPipSize } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Trophy, Target, Clock, Shield } from "lucide-react"

interface ReplayScoreCardProps {
  trade: ReplayTradeInfo
  candles: ReplayCandle[]
  visible: boolean
}

interface ScoreItemProps {
  icon: typeof Trophy
  label: string
  value: string
  detail: string
  score: number
}

function ScoreItem({ icon: Icon, label, value, detail, score }: ScoreItemProps) {
  const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-400"
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <Icon className="text-muted-foreground size-3" aria-hidden="true" />
        <span className="text-muted-foreground text-[10px]">{label}</span>
      </div>
      <p className={cn("text-sm font-bold", color)}>{value}</p>
      <p className="text-muted-foreground text-[10px]">{detail}</p>
      <div className="bg-muted h-1 overflow-hidden rounded-full" role="presentation">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-400",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export function ReplayScoreCard({ trade, candles, visible }: ReplayScoreCardProps) {
  if (!visible || !trade.exitPrice) return null

  const pip = getPipSize(trade.instrument)
  const isLong = trade.direction === "long"

  // Move captured: how much of the available move was secured?
  const entryToExit = Math.abs(trade.exitPrice - trade.entryPrice) / pip
  const mfe = trade.mfe ?? entryToExit
  const moveCaptured = mfe > 0 ? Math.min(100, Math.round((entryToExit / mfe) * 100)) : 0

  // Risk management: how far did price draw against us vs the SL distance?
  const mae = trade.mae ?? 0
  const slDistance = trade.stopLoss ? Math.abs(trade.entryPrice - trade.stopLoss) / pip : 0
  const riskScore = slDistance > 0 ? Math.max(0, Math.round((1 - mae / slDistance) * 100)) : 50

  // Entry timing: how close to the best price in the 10 candles before entry?
  const entryTime = Math.floor(new Date(trade.openedAt).getTime() / 1000)
  const entryIdx = candles.findIndex((c) => c.time >= entryTime)
  const preEntryCandles = candles.slice(Math.max(0, entryIdx - 10), entryIdx)
  let timingScore = 50
  if (preEntryCandles.length > 0) {
    const bestEntry = isLong
      ? Math.min(...preEntryCandles.map((c) => c.low))
      : Math.max(...preEntryCandles.map((c) => c.high))
    const worstEntry = isLong
      ? Math.max(...preEntryCandles.map((c) => c.high))
      : Math.min(...preEntryCandles.map((c) => c.low))
    const range = Math.abs(worstEntry - bestEntry)
    if (range > 0) {
      const entryQuality = isLong
        ? 1 - (trade.entryPrice - bestEntry) / range
        : 1 - (bestEntry - trade.entryPrice) / range
      timingScore = Math.max(0, Math.min(100, Math.round(entryQuality * 100)))
    }
  }

  // Duration
  const durationMs = trade.closedAt
    ? new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()
    : 0
  const durationHrs = durationMs / 3_600_000
  const durationLabel =
    durationHrs < 1 ? `${Math.round(durationHrs * 60)}m` : `${durationHrs.toFixed(1)}h`

  const isWin = trade.realizedPL >= 0

  return (
    <section
      className={cn(
        "rounded-lg border px-4 py-3 transition-all",
        isWin ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5",
      )}
      aria-label="Trade score card"
    >
      <div className="mb-3 flex items-center gap-2">
        <Trophy
          className={cn("size-4", isWin ? "text-emerald-500" : "text-red-400")}
          aria-hidden="true"
        />
        <span className="text-sm font-semibold">
          {isWin ? "Trade Report Card" : "Trade Review"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScoreItem
          icon={Target}
          label="Move Captured"
          value={`${moveCaptured}%`}
          detail={`Got ${entryToExit.toFixed(1)} of ${mfe.toFixed(1)} pips`}
          score={moveCaptured}
        />
        <ScoreItem
          icon={Shield}
          label="Risk Control"
          value={riskScore >= 70 ? "Good" : riskScore >= 40 ? "OK" : "Risky"}
          detail={mae > 0 ? `Max drawdown: ${mae.toFixed(1)}p` : "No drawdown data"}
          score={riskScore}
        />
        <ScoreItem
          icon={Clock}
          label="Entry Timing"
          value={timingScore >= 70 ? "Good" : timingScore >= 40 ? "OK" : "Late"}
          detail={`Entered near ${timingScore >= 50 ? "optimal" : "suboptimal"} price`}
          score={timingScore}
        />
        <ScoreItem
          icon={Clock}
          label="Duration"
          value={durationLabel}
          detail={isWin ? "Trade closed in profit" : "Trade closed at a loss"}
          score={isWin ? 80 : 30}
        />
      </div>
    </section>
  )
}
