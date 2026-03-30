"use client"

import type { TradeSource } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SOURCE_CONFIG: Record<TradeSource, { label: string; className: string }> = {
  oanda: {
    label: "OANDA",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  manual: {
    label: "FXFlow",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  automated: {
    label: "Auto",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  ut_bot_alerts: {
    label: "TradingView Alert",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  trade_finder: {
    label: "Trade Finder (Manual)",
    className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
  trade_finder_auto: {
    label: "Trade Finder (Automatic)",
    className: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  },
  ai_trader: {
    label: "EdgeFinder",
    className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  ai_trader_manual: {
    label: "EdgeFinder (Manual)",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  smart_flow: {
    label: "SmartFlow",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
}

interface SourceBadgeProps {
  source: TradeSource
  /** Optional score/confidence indicator shown after the label */
  indicator?: string | null
  className?: string
}

/** Color a score indicator: green >= 80%, amber >= 50%, orange > 0% */
function indicatorColor(source: TradeSource): string {
  switch (source) {
    case "trade_finder":
    case "trade_finder_auto":
      return "text-teal-500 dark:text-teal-400"
    case "ai_trader":
    case "ai_trader_manual":
      return "text-indigo-500 dark:text-indigo-400"
    case "smart_flow":
      return "text-sky-500 dark:text-sky-400"
    case "ut_bot_alerts":
      return "text-emerald-500 dark:text-emerald-400"
    default:
      return "text-muted-foreground"
  }
}

export function SourceBadge({ source, indicator, className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.oanda
  return (
    <Badge
      variant="outline"
      className={cn("px-1.5 py-0 text-[10px] font-medium", config.className, className)}
    >
      {config.label}
      {indicator && (
        <span className={cn("ml-1 font-mono font-bold tabular-nums", indicatorColor(source))}>
          {indicator}
        </span>
      )}
    </Badge>
  )
}
