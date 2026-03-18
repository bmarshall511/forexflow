"use client"

import type { TradeFinderAutoTradeEvent } from "@fxflow/types"
import { formatInstrument } from "@fxflow/shared"
import { formatRelativeTime } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface AutoTradeLogProps {
  events: TradeFinderAutoTradeEvent[]
}

const EVENT_CONFIG: Record<
  TradeFinderAutoTradeEvent["type"],
  {
    icon: typeof Zap
    label: string
    dotColor: string
    textColor: string
  }
> = {
  placed: { icon: Zap, label: "Placed", dotColor: "bg-green-500", textColor: "text-green-500" },
  filled: {
    icon: CheckCircle2,
    label: "Filled",
    dotColor: "bg-blue-500",
    textColor: "text-blue-500",
  },
  skipped: {
    icon: MinusCircle,
    label: "Skipped",
    dotColor: "bg-amber-500",
    textColor: "text-amber-500",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    dotColor: "bg-red-500",
    textColor: "text-red-500",
  },
  failed: {
    icon: AlertTriangle,
    label: "Failed",
    dotColor: "bg-red-500",
    textColor: "text-red-500",
  },
}

export function AutoTradeLog({ events }: AutoTradeLogProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No auto-trade activity yet.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Events will appear here when auto-trade places, fills, skips, or cancels orders.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-1">
      {events.map((event, i) => {
        const config = EVENT_CONFIG[event.type]
        const Icon = config.icon
        return (
          <div
            key={`${event.setupId}-${event.type}-${event.timestamp}-${i}`}
            className="hover:bg-muted/50 flex items-start gap-2.5 rounded-md px-3 py-2 transition-colors"
          >
            {/* Status indicator */}
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                `${config.dotColor}/10`,
              )}
            >
              <Icon className={cn("size-3", config.textColor)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium">{formatInstrument(event.instrument)}</span>
                <Badge
                  variant="outline"
                  className={cn("px-1.5 py-0 text-[10px]", config.textColor, `border-current/20`)}
                >
                  {config.label}
                </Badge>
                {event.score > 0 && (
                  <span className="text-muted-foreground text-[10px]">{event.score}/16</span>
                )}
              </div>
              {event.reason && (
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{event.reason}</p>
              )}
              {event.type === "placed" && event.entryPrice && (
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  LIMIT @ {event.entryPrice.toFixed(5)}
                </p>
              )}
            </div>

            {/* Timestamp */}
            <span className="text-muted-foreground mt-0.5 shrink-0 text-[10px]">
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
