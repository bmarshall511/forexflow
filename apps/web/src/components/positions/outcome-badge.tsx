"use client"

import type { TradeOutcome, TradeCloseReason, CloseContext } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface OutcomeBadgeProps {
  outcome: TradeOutcome
  closeReason?: TradeCloseReason
  closeContext?: CloseContext | null
  className?: string
}

const outcomeLabels: Record<TradeOutcome, string> = {
  win: "Win",
  loss: "Loss",
  breakeven: "Breakeven",
}

const reasonLabels: Record<string, string> = {
  STOP_LOSS_ORDER: "Stop Loss",
  TAKE_PROFIT_ORDER: "Take Profit",
  TRAILING_STOP_LOSS_ORDER: "Trailing Stop",
  MARGIN_CLOSEOUT: "Margin",
  MARKET_ORDER: "Manual",
  LINKED_TRADE_CLOSED: "Linked",
  REVERSAL: "Reversal",
  UNKNOWN: "",
}

export function OutcomeBadge({ outcome, closeReason, closeContext, className }: OutcomeBadgeProps) {
  // When a SL was moved to breakeven by an AI condition and then hit, show "SL (AI Breakeven)"
  const isAIBreakevenSL = closeReason === "STOP_LOSS_ORDER" && closeContext?.breakeven === true
  const reasonLabel = isAIBreakevenSL
    ? "AI Breakeven"
    : closeReason
      ? reasonLabels[closeReason]
      : ""
  const label = reasonLabel ? `${outcomeLabels[outcome]} (${reasonLabel})` : outcomeLabels[outcome]

  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-[10px] font-medium",
        outcome === "win" &&
          "border-status-connected/30 bg-status-connected/10 text-status-connected",
        outcome === "loss" &&
          "border-status-disconnected/30 bg-status-disconnected/10 text-status-disconnected",
        outcome === "breakeven" && !isAIBreakevenSL && "border-border text-muted-foreground",
        // AI breakeven SL hits get amber styling — it's a capital preservation event
        isAIBreakevenSL && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      {label}
    </Badge>
  )
}
