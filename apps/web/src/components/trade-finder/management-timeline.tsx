"use client"

import type { TradeFinderManagementAction } from "@fxflow/types"
import { TF_MGMT_ACTION_LABELS } from "@/lib/trade-finder-display"
import { formatRelativeTime } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Shield, Scissors, TrendingUp, Clock, Bot, ArrowUpDown } from "lucide-react"

const ACTION_ICONS: Record<string, typeof Shield> = {
  breakeven: Shield,
  partial_close: Scissors,
  thirds_partial: Scissors,
  trailing_update: TrendingUp,
  time_exit: Clock,
  ai_handoff: Bot,
  adaptive_partial: ArrowUpDown,
}

const ACTION_COLORS: Record<string, string> = {
  breakeven: "text-blue-400",
  partial_close: "text-amber-400",
  thirds_partial: "text-amber-400",
  trailing_update: "text-green-400",
  time_exit: "text-red-400",
  ai_handoff: "text-indigo-400",
  adaptive_partial: "text-purple-400",
}

interface ManagementTimelineProps {
  actions: TradeFinderManagementAction[]
  maxVisible?: number
}

export function ManagementTimeline({ actions, maxVisible = 5 }: ManagementTimelineProps) {
  const visible = actions.slice(-maxVisible)

  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
        Management Log
      </span>
      {visible.map((action, i) => {
        const Icon = ACTION_ICONS[action.action] ?? Shield
        const color = ACTION_COLORS[action.action] ?? "text-muted-foreground"

        return (
          <div key={`${action.action}-${action.timestamp}-${i}`} className="flex items-start gap-2">
            <Icon className={cn("mt-0.5 size-3 shrink-0", color)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[11px] font-medium", color)}>
                  {TF_MGMT_ACTION_LABELS[action.action] ?? action.action}
                </span>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {formatRelativeTime(action.timestamp)}
                </span>
              </div>
              <p className="text-muted-foreground truncate text-[10px]">{action.detail}</p>
            </div>
          </div>
        )
      })}
      {actions.length > maxVisible && (
        <p className="text-muted-foreground text-[10px]">
          +{actions.length - maxVisible} earlier actions
        </p>
      )}
    </div>
  )
}
