"use client"

import type { TradeEventData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { Scissors, CircleDot } from "lucide-react"
import { cn } from "@/lib/utils"

function parseDetail(detail: string): Record<string, unknown> {
  try {
    return JSON.parse(detail) as Record<string, unknown>
  } catch {
    return {}
  }
}

function formatDuration(entryMs: number, eventMs: number): string {
  const m = Math.floor((eventMs - entryMs) / 60_000)
  if (m < 0) return "—"
  if (m < 60) return `${m}m after entry`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 > 0 ? `${h}h ${m % 60}m after entry` : `${h}h after entry`
  const d = Math.floor(h / 24)
  return h % 24 > 0 ? `${d}d ${h % 24}h after entry` : `${d}d after entry`
}

interface PartialCloseTimelineProps {
  events: TradeEventData[]
  originalUnits: number
  instrument: string
  entryTime: string
  currency?: string
  className?: string
}

export function PartialCloseTimeline({
  events,
  originalUnits,
  entryTime,
  currency = "USD",
  className,
}: PartialCloseTimelineProps) {
  const partials = events.filter((e) => e.eventType === "PARTIAL_CLOSE")
  if (partials.length === 0) return null

  const entryMs = new Date(entryTime).getTime()
  let remaining = originalUnits
  let runningPL = 0

  const nodes = partials.map((evt) => {
    const d = parseDetail(evt.detail)
    const closed = Math.abs(Number(d.units) || 0)
    const pl = Number(d.realizedPL) || 0
    remaining -= closed
    runningPL += pl
    const ms = d.time ? new Date(d.time as string).getTime() : new Date(evt.createdAt).getTime()
    return { id: evt.id, closed, rem: Math.max(remaining, 0), pl, total: runningPL, ms }
  })

  const pct = Math.round(Math.max(0, Math.min(100, (remaining / originalUnits) * 100)))

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Position remaining</span>
          <span className="font-medium tabular-nums">{pct}%</span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-purple-500 transition-all"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of original position remaining`}
          />
        </div>
      </div>

      {/* Timeline nodes */}
      <div className="space-y-0">
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
              <CircleDot className="size-3.5 text-blue-500" />
            </div>
            <div className="bg-border/50 w-px flex-1" />
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <span className="text-xs font-medium">
              Entry: {originalUnits.toLocaleString()} units
            </span>
          </div>
        </div>

        {nodes.map((n, i) => {
          const last = i === nodes.length - 1
          return (
            <div key={n.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                  <Scissors className="size-3.5 text-purple-500" />
                </div>
                {!last && <div className="bg-border/50 w-px flex-1" />}
              </div>
              <div className={cn("min-w-0 flex-1", !last && "pb-4")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">
                    {n.rem === 0 ? "Final close" : "Partial close"}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap text-[10px]">
                    {formatDuration(entryMs, n.ms)}
                  </span>
                </div>
                <div className="bg-muted/40 mt-1.5 space-y-0.5 rounded-md px-2.5 py-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      -{n.closed.toLocaleString()} units
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {n.rem.toLocaleString()} remaining
                    </span>
                  </div>
                  {n.pl !== 0 && (
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          n.pl >= 0 ? "text-status-connected" : "text-status-disconnected",
                        )}
                      >
                        {formatCurrency(n.pl, currency)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        total: {formatCurrency(n.total, currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
