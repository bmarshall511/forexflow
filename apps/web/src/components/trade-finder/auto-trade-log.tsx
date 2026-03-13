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

const EVENT_CONFIG: Record<TradeFinderAutoTradeEvent["type"], {
  icon: typeof Zap
  label: string
  dotColor: string
  textColor: string
}> = {
  placed: { icon: Zap, label: "Placed", dotColor: "bg-green-500", textColor: "text-green-500" },
  filled: { icon: CheckCircle2, label: "Filled", dotColor: "bg-blue-500", textColor: "text-blue-500" },
  skipped: { icon: MinusCircle, label: "Skipped", dotColor: "bg-amber-500", textColor: "text-amber-500" },
  cancelled: { icon: XCircle, label: "Cancelled", dotColor: "bg-red-500", textColor: "text-red-500" },
  failed: { icon: AlertTriangle, label: "Failed", dotColor: "bg-red-500", textColor: "text-red-500" },
}

export function AutoTradeLog({ events }: AutoTradeLogProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No auto-trade activity yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
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
            className="flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            {/* Status indicator */}
            <div className={cn("mt-0.5 shrink-0 size-5 rounded-full flex items-center justify-center", `${config.dotColor}/10`)}>
              <Icon className={cn("size-3", config.textColor)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium">{formatInstrument(event.instrument)}</span>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", config.textColor, `border-current/20`)}
                >
                  {config.label}
                </Badge>
                {event.score > 0 && (
                  <span className="text-[10px] text-muted-foreground">{event.score}/12</span>
                )}
              </div>
              {event.reason && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{event.reason}</p>
              )}
              {event.type === "placed" && event.entryPrice && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  LIMIT @ {event.entryPrice.toFixed(5)}
                </p>
              )}
            </div>

            {/* Timestamp */}
            <span className="shrink-0 text-[10px] text-muted-foreground mt-0.5">
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
