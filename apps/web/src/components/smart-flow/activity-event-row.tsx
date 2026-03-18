"use client"

import type { SmartFlowActivityEvent } from "@fxflow/types"
import { cn } from "@/lib/utils"

const SEVERITY_DOTS: Record<string, string> = {
  success: "bg-emerald-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
}

export function ActivityEventRow({ event }: { event: SmartFlowActivityEvent }) {
  const dotColor = SEVERITY_DOTS[event.severity] ?? SEVERITY_DOTS.info

  // Format time as HH:MM
  const time = new Date(event.timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="hover:bg-muted/50 flex items-start gap-2.5 rounded-md px-3 py-2 transition-colors">
      {/* Time */}
      <span className="text-muted-foreground mt-0.5 w-12 shrink-0 font-mono text-[10px]">
        {time}
      </span>

      {/* Severity dot */}
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotColor)} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-xs leading-snug">{event.message}</p>
        {event.detail && (
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{event.detail}</p>
        )}
      </div>
    </div>
  )
}
