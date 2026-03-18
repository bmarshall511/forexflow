"use client"

import type { SmartFlowTradeData, SmartFlowConfigData } from "@fxflow/types"
import { Progress } from "@/components/ui/progress"
import { getPipSize } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface TradePlanLevelsProps {
  config: SmartFlowConfigData
  trade: SmartFlowTradeData
  currentAtr: number | null
}

export function TradePlanLevels({ config, trade, currentAtr }: TradePlanLevelsProps) {
  const entry = trade.entryPrice
  if (!entry) return null

  const pip = getPipSize(config.instrument)
  const isLong = config.direction === "long"

  // Resolve SL/TP from ATR multiples or fixed pips (same logic as daemon)
  const atr = currentAtr ?? 0
  const slDistance =
    config.stopLossPips != null
      ? config.stopLossPips * pip
      : (config.stopLossAtrMultiple ?? 1.5) * atr
  const tpDistance =
    config.takeProfitPips != null
      ? config.takeProfitPips * pip
      : (config.takeProfitAtrMultiple ?? 2.0) * atr

  const stopLoss = isLong ? entry - slDistance : entry + slDistance
  const takeProfit = tpDistance > 0 ? (isLong ? entry + tpDistance : entry - tpDistance) : null

  // If breakeven triggered, safety is at entry
  const safety = trade.breakevenTriggered ? entry : stopLoss
  const safetyLabel = trade.breakevenTriggered ? "(break-even)" : ""

  const safetyPips = pip > 0 ? Math.abs(entry - safety) / pip : 0
  const targetPips = takeProfit && pip > 0 ? Math.abs(takeProfit - entry) / pip : null

  // Progress: safety pips moved away from entry vs total target pips
  const progressPercent =
    targetPips && targetPips > 0 ? Math.min(100, Math.max(0, (safetyPips / targetPips) * 100)) : 0

  const decimals = pip < 0.001 ? 5 : pip < 0.01 ? 4 : 3

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
        Trade Levels
      </p>
      <div className="space-y-1 text-[11px]">
        <LevelRow label="Entry" price={entry} decimals={decimals} />
        {takeProfit != null && (
          <LevelRow
            label="Target"
            price={takeProfit}
            decimals={decimals}
            pips={targetPips}
            pipsColor="text-emerald-500"
          />
        )}
        <LevelRow
          label="Safety"
          price={safety}
          decimals={decimals}
          pips={safetyPips > 0 ? safetyPips : null}
          pipsColor="text-red-400"
          suffix={safetyLabel}
        />
      </div>
      {targetPips != null && targetPips > 0 && (
        <div className="flex items-center gap-2">
          <Progress value={progressPercent} className="h-1.5 flex-1" />
          <span className="text-muted-foreground shrink-0 text-[10px]">
            {Math.round(progressPercent)}% to target
          </span>
        </div>
      )}
    </div>
  )
}

function LevelRow({
  label,
  price,
  decimals,
  pips,
  pipsColor,
  suffix,
}: {
  label: string
  price: number
  decimals: number
  pips?: number | null
  pipsColor?: string
  suffix?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground w-14">{label}</span>
      <span className="font-mono font-medium">{price.toFixed(decimals)}</span>
      <span className="w-24 text-right">
        {pips != null && (
          <span className={cn("font-mono text-[10px]", pipsColor)}>{pips.toFixed(0)}p</span>
        )}
        {suffix && <span className="text-muted-foreground ml-1 text-[9px]">{suffix}</span>}
      </span>
    </div>
  )
}
