"use client"

import type { SmartFlowTradeData } from "@fxflow/types"
import { formatInstrument } from "@fxflow/shared"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, Target } from "lucide-react"
import { cn } from "@/lib/utils"

const PRESET_LABELS: Record<string, string> = {
  momentum_catch: "Momentum Catch",
  steady_growth: "Steady Growth",
  swing_capture: "Swing Capture",
  trend_rider: "Trend Rider",
  recovery: "Recovery Mode",
  custom: "Custom",
}

interface HistoryTradeCardProps {
  trade: SmartFlowTradeData
}

export function HistoryTradeCard({ trade }: HistoryTradeCardProps) {
  const instrument = trade.instrument ? formatInstrument(trade.instrument) : "Unknown"
  const direction = trade.direction ?? "long"
  const preset = PRESET_LABELS[trade.preset ?? ""] ?? trade.preset ?? "Custom"
  const wasSafetyNet = trade.safetyNetTriggered != null

  // Duration
  const durationMs =
    trade.closedAt && trade.createdAt
      ? new Date(trade.closedAt).getTime() - new Date(trade.createdAt).getTime()
      : 0
  const durationHrs = durationMs / 3_600_000
  const durationStr =
    durationHrs < 1
      ? `${Math.round(durationHrs * 60)}m`
      : durationHrs < 24
        ? `${durationHrs.toFixed(1)}h`
        : `${Math.round(durationHrs / 24)}d`

  // Date
  const closedDate = trade.closedAt
    ? new Date(trade.closedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "--"

  // Management actions summary
  const actions: string[] = []
  if (trade.breakevenTriggered) actions.push("Break-even")
  if (trade.trailingActivated) actions.push("Trailing")
  if (trade.partialCloseLog.length > 0)
    actions.push(
      `${trade.partialCloseLog.length} partial${trade.partialCloseLog.length > 1 ? "s" : ""}`,
    )
  if (wasSafetyNet) actions.push(formatSafetyNet(trade.safetyNetTriggered!))

  // Outcome
  const outcomeLabel = wasSafetyNet ? "Safety exit" : "Target reached"
  const outcomeColor = wasSafetyNet ? "text-amber-500" : "text-emerald-500"
  const OutcomeIcon = wasSafetyNet ? ShieldAlert : Target

  return (
    <div className="hover:bg-muted/50 flex items-start gap-3 rounded-lg px-3 py-3 transition-colors">
      {/* Outcome indicator */}
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          wasSafetyNet ? "bg-amber-500/10" : "bg-emerald-500/10",
        )}
      >
        <OutcomeIcon className={cn("size-4", outcomeColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{instrument}</span>
          <DirectionBadge direction={direction as "long" | "short"} />
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {preset}
          </Badge>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          <span className={cn("font-medium", outcomeColor)}>{outcomeLabel}</span>
          <span className="text-muted-foreground">{durationStr}</span>
          <span className="text-muted-foreground">{closedDate}</span>
        </div>

        {/* Management actions taken */}
        {actions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {actions.map((action) => (
              <span
                key={action}
                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
              >
                {action}
              </span>
            ))}
          </div>
        )}

        {/* Management log count */}
        {trade.managementLog.length > 0 && (
          <p className="text-muted-foreground mt-1 text-[10px]">
            {trade.managementLog.length} management action
            {trade.managementLog.length > 1 ? "s" : ""} taken
          </p>
        )}
      </div>
    </div>
  )
}

function formatSafetyNet(net: string): string {
  const map: Record<string, string> = {
    max_drawdown: "Max loss protection",
    max_hold: "Time limit reached",
    max_financing: "Fee limit reached",
    margin_warning: "Margin warning",
  }
  return map[net] ?? net
}
