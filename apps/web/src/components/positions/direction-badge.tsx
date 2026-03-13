"use client"

import type { TradeDirection } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DirectionBadgeProps {
  direction: TradeDirection
  className?: string
}

export function DirectionBadge({ direction, className }: DirectionBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0 font-semibold uppercase",
        direction === "long"
          ? "border-status-connected/30 bg-status-connected/10 text-status-connected"
          : "border-status-disconnected/30 bg-status-disconnected/10 text-status-disconnected",
        className,
      )}
    >
      {direction}
    </Badge>
  )
}
