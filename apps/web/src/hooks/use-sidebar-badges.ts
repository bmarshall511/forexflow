"use client"

import { useMemo } from "react"
import { Bot, Clock, Crosshair, Radio, TrendingUp, type LucideIcon } from "lucide-react"
import { useDaemonStatus } from "./use-daemon-status"
import { useDaemonConnection } from "./use-daemon-connection"
import { usePositions } from "./use-positions"
import { useActiveAiAnalyses } from "./use-active-ai-analyses"

export interface NavBadge {
  count: number
  /** Tooltip / aria label, e.g. "open", "pending" */
  label: string
  /** Tailwind text color class for the count + icon */
  color: string
  /** Optional micro-icon shown before the count (for multi-badge disambiguation) */
  icon?: LucideIcon
}

/** Returns a map of badge keys → array of badge items for sidebar nav. */
export function useSidebarBadges(): Record<string, NavBadge[]> {
  const { tvAlertsStatus } = useDaemonStatus()
  const { tradeFinderScanStatus, lastAiTraderScanStatus } = useDaemonConnection()
  const { summary } = usePositions()
  const activeAnalyses = useActiveAiAnalyses()

  return useMemo(
    () => ({
      positions: [
        { count: summary.openCount, label: "open", color: "text-blue-500", icon: TrendingUp },
        { count: summary.pendingCount, label: "pending", color: "text-amber-500", icon: Clock },
      ],
      tradeFinder: [
        {
          count: tradeFinderScanStatus?.activeSetups ?? 0,
          label: "setups",
          color: "text-blue-500",
          icon: Crosshair,
        },
      ],
      aiTrader: [
        {
          count: lastAiTraderScanStatus?.openAiTradeCount ?? 0,
          label: "trades",
          color: "text-indigo-500",
          icon: Bot,
        },
      ],
      tvAlerts: [
        {
          count: tvAlertsStatus?.activeAutoPositions ?? 0,
          label: "positions",
          color: "text-emerald-500",
          icon: TrendingUp,
        },
        {
          count: tvAlertsStatus?.signalCountToday ?? 0,
          label: "signals today",
          color: "text-blue-500",
          icon: Radio,
        },
      ],
      aiAnalysis: [
        {
          count: Object.keys(activeAnalyses).length,
          label: "in progress",
          color: "text-purple-500",
        },
      ],
    }),
    [
      summary.openCount,
      summary.pendingCount,
      tradeFinderScanStatus?.activeSetups,
      lastAiTraderScanStatus?.openAiTradeCount,
      tvAlertsStatus?.activeAutoPositions,
      tvAlertsStatus?.signalCountToday,
      activeAnalyses,
    ],
  )
}
