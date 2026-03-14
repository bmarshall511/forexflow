"use client"

import { cn } from "@/lib/utils"
import {
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Radio,
  Bot,
  Search,
  Sparkles,
  Bell,
  Zap,
} from "lucide-react"
import type { ActivityEventType } from "@/hooks/use-activity-feed"

const iconMap: Record<ActivityEventType, React.ElementType> = {
  trade_closed: CheckCircle,
  trade_opened: ArrowUpRight,
  order_placed: Clock,
  tv_signal: Radio,
  ai_opportunity: Bot,
  trade_finder_setup: Search,
  ai_analysis_completed: Sparkles,
  price_alert: Bell,
  condition_triggered: Zap,
}

const intentStyles = {
  positive: "text-status-connected bg-status-connected/10",
  negative: "text-status-disconnected bg-status-disconnected/10",
  neutral: "text-muted-foreground bg-muted",
  info: "text-blue-500 bg-blue-500/10",
  warning: "text-amber-500 bg-amber-500/10",
} as const

function formatRelative(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

interface ActivityItemProps {
  type: ActivityEventType
  title: string
  detail?: string
  timestamp: string
  intent: "positive" | "negative" | "neutral" | "info" | "warning"
  className?: string
}

export function ActivityItem({
  type,
  title,
  detail,
  timestamp,
  intent,
  className,
}: ActivityItemProps) {
  const Icon = iconMap[type]

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 py-2 text-xs",
        "animate-in fade-in slide-in-from-top-1 duration-300",
        className,
      )}
    >
      {/* Icon */}
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          intentStyles[intent],
        )}
      >
        <Icon className="size-3" />
      </span>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{title}</span>
        {detail && <span className="text-muted-foreground truncate text-[10px]">{detail}</span>}
      </div>

      {/* Time */}
      <span className="text-muted-foreground/60 shrink-0 text-[10px] tabular-nums">
        {formatRelative(timestamp)}
      </span>
    </div>
  )
}
