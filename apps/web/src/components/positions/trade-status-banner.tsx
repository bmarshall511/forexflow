"use client"

import type { TradeOutcome, TradeCloseReason, OrderType } from "@fxflow/types"
import { cn } from "@/lib/utils"
import { Clock, CircleDot, CheckCircle2 } from "lucide-react"
import { OutcomeBadge } from "./outcome-badge"
import { DurationDisplay } from "./duration-display"

interface TradeStatusBannerProps {
  status: "pending" | "open" | "closed"
  orderType?: OrderType | string | null
  openedAt?: string
  closedAt?: string | null
  outcome?: TradeOutcome | null
  closeReason?: TradeCloseReason | string | null
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "Pending Order",
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  open: {
    icon: CircleDot,
    label: "Open Trade",
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  closed: {
    icon: CheckCircle2,
    label: "Closed Trade",
    bg: "bg-muted/50 border-border/50",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
} as const

export function TradeStatusBanner({
  status,
  orderType,
  openedAt,
  closedAt,
  outcome,
  closeReason,
}: TradeStatusBannerProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg border px-3 py-2",
      config.bg,
    )}>
      <div className="flex items-center gap-2">
        <div className={cn("size-2 rounded-full animate-pulse", config.dot)} />
        <span className={cn("text-xs font-semibold", config.text)}>
          {config.label}
          {status === "pending" && orderType && (
            <span className="font-normal ml-1 opacity-70">
              ({orderType.replace("_", " ")})
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {status === "open" && openedAt && (
          <DurationDisplay
            openedAt={openedAt}
            className={cn("text-[10px] font-mono tabular-nums", config.text)}
          />
        )}
        {status === "closed" && outcome && (
          <OutcomeBadge
            outcome={outcome}
            closeReason={closeReason as TradeCloseReason}
          />
        )}
      </div>
    </div>
  )
}
