"use client"

import type { TradeDirection } from "@fxflow/types"
import { calculateRiskReward, formatPips } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"

interface RiskRewardDisplayProps {
  direction: TradeDirection
  entryPrice: number
  stopLoss: number | null
  takeProfit: number | null
  instrument: string
  compact?: boolean
}

export function RiskRewardDisplay({
  direction,
  entryPrice,
  stopLoss,
  takeProfit,
  instrument,
  compact = false,
}: RiskRewardDisplayProps) {
  const result = calculateRiskReward(direction, entryPrice, stopLoss, takeProfit, instrument)

  if (result.unprotected) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-status-warning border-status-warning/30">
        Unprotected
      </Badge>
    )
  }

  if (!result.ratio) {
    return <span className="text-xs text-muted-foreground">N/A</span>
  }

  if (compact) {
    return <span className="text-xs font-mono tabular-nums">{result.ratio}</span>
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs font-mono tabular-nums font-medium">{result.ratio}</span>
      <span className="text-[10px] text-muted-foreground">
        {result.riskPips !== null ? formatPips(result.riskPips) : "—"} / {result.rewardPips !== null ? formatPips(result.rewardPips) : "—"}
      </span>
    </div>
  )
}
