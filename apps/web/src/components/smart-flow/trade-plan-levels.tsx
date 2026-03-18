"use client"

import type { SmartFlowTradeData, SmartFlowConfigData } from "@fxflow/types"
import { getPipSize } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Target, ShieldAlert, ArrowRight } from "lucide-react"

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
  const safety = trade.breakevenTriggered ? entry : stopLoss
  const safetyPips = pip > 0 ? Math.abs(entry - safety) / pip : 0
  const targetPips = takeProfit && pip > 0 ? Math.abs(takeProfit - entry) / pip : null
  const progressPercent =
    targetPips && targetPips > 0 ? Math.min(100, Math.max(0, (safetyPips / targetPips) * 100)) : 0
  const decimals = pip < 0.001 ? 5 : pip < 0.01 ? 4 : 3

  return (
    <div className="space-y-3">
      {/* Price levels as a visual row */}
      <div className="grid grid-cols-3 gap-2">
        <LevelBox
          label="Entry"
          price={entry}
          decimals={decimals}
          color="text-foreground"
          bgColor="bg-muted/50"
        />
        {takeProfit != null && (
          <LevelBox
            label="Target"
            price={takeProfit}
            decimals={decimals}
            pips={targetPips}
            color="text-emerald-500"
            bgColor="bg-emerald-500/5"
            icon={<Target className="size-3 text-emerald-500" aria-hidden="true" />}
          />
        )}
        <LevelBox
          label={trade.breakevenTriggered ? "Safety ✓" : "Safety"}
          price={safety}
          decimals={decimals}
          pips={safetyPips > 0 ? safetyPips : null}
          color={trade.breakevenTriggered ? "text-emerald-500" : "text-red-400"}
          bgColor={trade.breakevenTriggered ? "bg-emerald-500/5" : "bg-red-500/5"}
          icon={
            <ShieldAlert
              className={cn(
                "size-3",
                trade.breakevenTriggered ? "text-emerald-500" : "text-red-400",
              )}
              aria-hidden="true"
            />
          }
        />
      </div>

      {/* Progress bar toward target */}
      {targetPips != null && targetPips > 0 && (
        <div className="space-y-1">
          <div className="bg-muted relative h-2 overflow-hidden rounded-full">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Entry</span>
            <span className="text-muted-foreground flex items-center gap-1">
              <ArrowRight className="size-2.5" aria-hidden="true" />
              {Math.round(progressPercent)}% to target
            </span>
            <span className="font-medium text-emerald-500">{targetPips.toFixed(0)}p</span>
          </div>
        </div>
      )}
    </div>
  )
}

function LevelBox({
  label,
  price,
  decimals,
  pips,
  color,
  bgColor,
  icon,
}: {
  label: string
  price: number
  decimals: number
  pips?: number | null
  color: string
  bgColor: string
  icon?: React.ReactNode
}) {
  return (
    <div className={cn("rounded-lg px-2.5 py-2 text-center", bgColor)}>
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-muted-foreground text-[9px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={cn("mt-0.5 font-mono text-sm font-bold", color)}>{price.toFixed(decimals)}</p>
      {pips != null && <p className={cn("font-mono text-[10px]", color)}>{pips.toFixed(0)} pips</p>}
    </div>
  )
}
