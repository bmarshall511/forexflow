"use client"

/**
 * Chronological timeline of management actions, partial closes, and AI
 * suggestions for a closed SmartFlow trade. Rendered inside the Trade
 * Review drawer.
 */

import { Bot, Cog, TrendingUp, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TimelineEvent } from "./trade-review-utils"
import { formatTimeShort, humaniseAction } from "./trade-review-utils"

export function TradeReviewTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-xs italic">
        No management actions fired for this trade.
      </p>
    )
  }
  return (
    <ol className="divide-border bg-muted/20 divide-y rounded-md border">
      {events.map((e, i) => (
        <li key={`${e.kind}-${e.at}-${i}`} className="px-3 py-2.5 text-xs">
          <TimelineRow event={e} />
        </li>
      ))}
    </ol>
  )
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  if (event.kind === "management") {
    const SourceIcon = event.source === "rule" ? Cog : event.source === "ai" ? Bot : User
    const sourceColor =
      event.source === "rule"
        ? "text-blue-500"
        : event.source === "ai"
          ? "text-purple-500"
          : "text-muted-foreground"
    return (
      <div className="flex items-start gap-2">
        <SourceIcon className={cn("mt-0.5 size-3.5 shrink-0", sourceColor)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{humaniseAction(event.action)}</span>
            <span className="text-muted-foreground shrink-0 text-[10px]">
              {formatTimeShort(event.at)}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 leading-snug">{event.detail}</p>
        </div>
      </div>
    )
  }
  if (event.kind === "partial") {
    const plColor =
      event.pnl > 0 ? "text-emerald-500" : event.pnl < 0 ? "text-red-500" : "text-muted-foreground"
    return (
      <div className="flex items-start gap-2">
        <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Partial close {event.percent}%</span>
            <span className="text-muted-foreground shrink-0 text-[10px]">
              {formatTimeShort(event.at)}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 leading-snug">
            {event.pips.toFixed(1)} pips ·{" "}
            <span className={plColor}>
              {event.pnl >= 0 ? "+" : ""}${event.pnl.toFixed(2)}
            </span>
          </p>
        </div>
      </div>
    )
  }
  // kind === "ai"
  return (
    <div className="flex items-start gap-2">
      <Bot className="mt-0.5 size-3.5 shrink-0 text-purple-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">
            AI {event.autoExecuted ? "executed" : "suggested"}: {humaniseAction(event.action)}
          </span>
          <span className="text-muted-foreground shrink-0 text-[10px]">
            {formatTimeShort(event.at)}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 leading-snug">
          {event.confidence}% · {event.rationale}
        </p>
      </div>
    </div>
  )
}
