"use client"

import { useMemo } from "react"
import { Clock, TrendingUp, type LucideIcon } from "lucide-react"
import { useDaemonStatus } from "./use-daemon-status"
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
  const { summary } = usePositions()
  const activeAnalyses = useActiveAiAnalyses()

  return useMemo(
    () => ({
      positions: [
        { count: summary.openCount, label: "open", color: "text-blue-500", icon: TrendingUp },
        { count: summary.pendingCount, label: "pending", color: "text-amber-500", icon: Clock },
      ],
      tvAlerts: [
        {
          count: tvAlertsStatus?.signalCountToday ?? 0,
          label: "signals today",
          color: "text-emerald-500",
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
    [summary.openCount, summary.pendingCount, tvAlertsStatus?.signalCountToday, activeAnalyses],
  )
}
