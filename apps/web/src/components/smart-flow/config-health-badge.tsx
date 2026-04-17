"use client"

import type { SmartFlowConfigHealth, SmartFlowConfigHealthStatus } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Pause,
  Activity,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<
  SmartFlowConfigHealthStatus,
  {
    label: string
    icon: LucideIcon
    variant: "default" | "secondary" | "destructive" | "outline"
    className: string
  }
> = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle2,
    variant: "default",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  active_trade: {
    label: "Trading",
    icon: Activity,
    variant: "default",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  waiting_entry: {
    label: "Watching",
    icon: Clock,
    variant: "default",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    variant: "secondary",
    className: "text-muted-foreground",
  },
  blocked_rr: {
    label: "R:R Blocked",
    icon: XCircle,
    variant: "destructive",
    className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  blocked_spread: {
    label: "Spread",
    icon: AlertTriangle,
    variant: "destructive",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  blocked_margin: {
    label: "Margin",
    icon: XCircle,
    variant: "destructive",
    className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  blocked_correlation: {
    label: "Correlated",
    icon: AlertTriangle,
    variant: "destructive",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  blocked_source_priority: {
    label: "Priority",
    icon: AlertTriangle,
    variant: "destructive",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  blocked_atr: {
    label: "No Data",
    icon: Clock,
    variant: "secondary",
    className: "border-gray-500/30 bg-gray-500/10 text-gray-600 dark:text-gray-400",
  },
  direction_stale: {
    label: "Stale",
    icon: AlertTriangle,
    variant: "destructive",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  scanner_disabled: {
    label: "Scanner Off",
    icon: Pause,
    variant: "secondary",
    className: "text-muted-foreground",
  },
}

interface ConfigHealthBadgeProps {
  health: SmartFlowConfigHealth | null
  className?: string
}

export function ConfigHealthBadge({ health, className }: ConfigHealthBadgeProps) {
  if (!health) return null

  const config = STATUS_CONFIG[health.status] ?? STATUS_CONFIG.healthy
  const Icon = config.icon

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1 border px-1.5 py-0 text-[10px] font-medium",
              config.className,
              className,
            )}
          >
            <Icon className="size-2.5" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-xs">
          <p>{health.message}</p>
          {health.computedRR != null && health.requiredRR != null && (
            <p className="text-muted-foreground mt-1">
              R:R {health.computedRR.toFixed(2)} / required {health.requiredRR.toFixed(1)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
