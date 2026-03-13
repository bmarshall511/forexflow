"use client"

import type { TradeEventData } from "@fxflow/types"
import { ArrowRight, Scissors, Shield, Target, XCircle, CircleDot } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Icon + color config ────────────────────────────────────────────────────

interface EventConfig {
  icon: typeof CircleDot
  label: string
  iconColor: string
  bgColor: string
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  SL_TP_MODIFIED: { icon: Shield, label: "SL/TP Modified", iconColor: "text-amber-500", bgColor: "bg-amber-500/10" },
  SL_MODIFIED: { icon: Shield, label: "Stop Loss Modified", iconColor: "text-amber-500", bgColor: "bg-amber-500/10" },
  TP_MODIFIED: { icon: Target, label: "Take Profit Modified", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
  PARTIAL_CLOSE: { icon: Scissors, label: "Partial Close", iconColor: "text-purple-500", bgColor: "bg-purple-500/10" },
  ORDER_CANCELLED: { icon: XCircle, label: "Order Cancelled", iconColor: "text-destructive", bgColor: "bg-destructive/10" },
  TRADE_CLOSED: { icon: XCircle, label: "Trade Closed", iconColor: "text-destructive", bgColor: "bg-destructive/10" },
}

const DEFAULT_CONFIG: EventConfig = {
  icon: CircleDot,
  label: "Event",
  iconColor: "text-muted-foreground",
  bgColor: "bg-muted",
}

// ─── Detail parsing ─────────────────────────────────────────────────────────

interface SltpDetail {
  oldSL?: number | null
  newSL?: number | null
  oldTP?: number | null
  newTP?: number | null
  modifiedBy?: string
  message?: string
}

function parseSltpDetail(detail: string): SltpDetail | null {
  try {
    const obj = JSON.parse(detail)
    if ("oldSL" in obj || "newSL" in obj || "oldTP" in obj || "newTP" in obj) {
      return obj as SltpDetail
    }
    return null
  } catch {
    return null
  }
}

function parseGenericDetail(detail: string): string {
  try {
    const obj = JSON.parse(detail)
    if (obj.message) return obj.message
    // Filter out internal fields
    const filtered = Object.entries(obj).filter(
      ([k]) => !["time", "modifiedBy"].includes(k),
    )
    if (filtered.length === 0) return ""
    return filtered.map(([k, v]) => `${formatKey(k)}: ${v}`).join(" · ")
  } catch {
    return detail
  }
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function formatPrice(val: number | null | undefined): string {
  if (val === null || val === undefined) return "None"
  return val.toString()
}

// ─── Time formatting ────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── SL/TP change display ───────────────────────────────────────────────────

function SltpChange({ label, oldVal, newVal }: {
  label: string
  oldVal: number | null | undefined
  newVal: number | null | undefined
}) {
  // Skip unchanged values
  if (oldVal === newVal) return null
  if (oldVal === undefined && newVal === undefined) return null

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground w-5">{label}</span>
      <span className="font-mono tabular-nums text-muted-foreground">
        {formatPrice(oldVal)}
      </span>
      <ArrowRight className="size-3 text-muted-foreground/50 shrink-0" />
      <span className="font-mono tabular-nums text-foreground font-medium">
        {formatPrice(newVal)}
      </span>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

interface TradeEventsTimelineProps {
  events: TradeEventData[]
}

export function TradeEventsTimeline({ events }: TradeEventsTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No events recorded yet.</p>
    )
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const config = EVENT_CONFIG[event.eventType] ?? DEFAULT_CONFIG
        const Icon = config.icon
        const isLast = idx === events.length - 1
        const isSltpEvent = event.eventType === "SL_TP_MODIFIED" ||
          event.eventType === "SL_MODIFIED" ||
          event.eventType === "TP_MODIFIED"
        const sltpDetail = isSltpEvent ? parseSltpDetail(event.detail) : null
        const genericText = !sltpDetail ? parseGenericDetail(event.detail) : null

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                config.bgColor,
              )}>
                <Icon className={cn("size-3.5", config.iconColor)} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border/50" />}
            </div>

            {/* Content */}
            <div className={cn("pb-4 min-w-0 flex-1", isLast && "pb-0")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{config.label}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatTime(event.createdAt)}
                </span>
              </div>

              {/* SL/TP structured detail */}
              {sltpDetail && (
                <div className="mt-1.5 space-y-0.5 rounded-md bg-muted/40 px-2.5 py-1.5">
                  <SltpChange label="SL" oldVal={sltpDetail.oldSL} newVal={sltpDetail.newSL} />
                  <SltpChange label="TP" oldVal={sltpDetail.oldTP} newVal={sltpDetail.newTP} />
                </div>
              )}

              {/* Generic detail text */}
              {genericText && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {genericText}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
