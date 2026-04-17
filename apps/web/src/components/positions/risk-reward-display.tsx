"use client"

import type { TradeDirection } from "@fxflow/types"
import { calculateRiskReward, formatPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"
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
      <Badge
        variant="outline"
        className="text-status-warning border-status-warning/30 px-1.5 py-0 text-[10px]"
      >
        Unprotected
      </Badge>
    )
  }

  if (!result.ratio) {
    return <span className="text-muted-foreground text-xs">N/A</span>
  }

  if (compact) {
    return (
      <span
        className={cn("font-mono text-xs tabular-nums", result.profitProtected && "text-green-500")}
      >
        {result.ratio}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "font-mono text-xs font-medium tabular-nums",
          result.profitProtected && "text-green-500",
        )}
      >
        {result.ratio}
      </span>
      {!result.profitProtected && (
        <span className="text-muted-foreground text-[10px]">
          {result.riskPips !== null ? formatPips(result.riskPips) : "—"} /{" "}
          {result.rewardPips !== null ? formatPips(result.rewardPips) : "—"}
        </span>
      )}
    </div>
  )
}
