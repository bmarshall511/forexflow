"use client"

import type { SmartFlowTradeData } from "@fxflow/types"
import { formatInstrument } from "@fxflow/shared"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, Target, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PRESET_LABELS,
  SAFETY_NET_LABELS,
  formatDurationMs,
  formatMoney,
  formatPips,
} from "./trade-review-utils"

interface HistoryTradeCardProps {
  trade: SmartFlowTradeData
  onSelect?: (trade: SmartFlowTradeData) => void
}

export function HistoryTradeCard({ trade, onSelect }: HistoryTradeCardProps) {
  const instrument = trade.instrument ? formatInstrument(trade.instrument) : "Unknown"
  const direction = trade.direction ?? "long"
  const preset = PRESET_LABELS[trade.preset ?? ""] ?? trade.preset ?? "Custom"
  const wasSafetyNet = trade.safetyNetTriggered != null

  const durationMs =
    trade.closedAt && trade.createdAt
      ? new Date(trade.closedAt).getTime() - new Date(trade.createdAt).getTime()
      : 0
  const durationStr = formatDurationMs(durationMs)

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
  if (wasSafetyNet)
    actions.push(SAFETY_NET_LABELS[trade.safetyNetTriggered!] ?? trade.safetyNetTriggered!)

  // Outcome
  const outcomeLabel = wasSafetyNet ? "Safety exit" : "Target reached"
  const outcomeColor = wasSafetyNet ? "text-amber-500" : "text-emerald-500"
  const OutcomeIcon = wasSafetyNet ? ShieldAlert : Target

  // Realised P&L — populated via the Trade join when available.
  const plValue = trade.realizedPL
  const plColor =
    plValue == null
      ? "text-muted-foreground"
      : plValue > 0
        ? "text-emerald-500"
        : plValue < 0
          ? "text-red-500"
          : "text-muted-foreground"
  const plText = formatMoney(plValue)
  const pipsText = trade.realizedPips == null ? null : formatPips(trade.realizedPips)

  const clickable = typeof onSelect === "function"

  return (
    <button
      type="button"
      onClick={clickable ? () => onSelect?.(trade) : undefined}
      disabled={!clickable}
      aria-label={`Review closed trade on ${instrument}, ${outcomeLabel}, ${plText}`}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        clickable &&
          "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-primary/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2",
        !clickable && "cursor-default",
      )}
    >
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

      {/* Realised P&L + chevron */}
      <div className="flex shrink-0 items-start gap-1">
        <div className="text-right">
          <p className={cn("text-sm font-semibold tabular-nums", plColor)}>{plText}</p>
          {pipsText && (
            <p className={cn("text-[10px] tabular-nums opacity-80", plColor)}>{pipsText}</p>
          )}
        </div>
        {clickable && <ChevronRight className="text-muted-foreground mt-1 size-4" />}
      </div>
    </button>
  )
}
