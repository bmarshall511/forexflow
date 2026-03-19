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
  SL_TP_MODIFIED: {
    icon: Shield,
    label: "SL/TP Modified",
    iconColor: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  SL_MODIFIED: {
    icon: Shield,
    label: "Stop Loss Modified",
    iconColor: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  TP_MODIFIED: {
    icon: Target,
    label: "Take Profit Modified",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  PARTIAL_CLOSE: {
    icon: Scissors,
    label: "Partial Close",
    iconColor: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  ORDER_CANCELLED: {
    icon: XCircle,
    label: "Order Cancelled",
    iconColor: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  TRADE_CLOSED: {
    icon: XCircle,
    label: "Trade Closed",
    iconColor: "text-destructive",
    bgColor: "bg-destructive/10",
  },
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

/** Map raw cancelledBy values to human-readable labels */
const CANCELLED_BY_LABELS: Record<string, string> = {
  user: "Manual",
  user_bulk: "Bulk Cancel",
  trade_finder: "Trade Finder",
  ai_condition: "AI Condition",
  system: "Auto (Reconcile)",
}

function parseCancelDetail(detail: string): { source: string; reason: string | null } | null {
  try {
    const obj = JSON.parse(detail)
    if (!obj.cancelledBy) return null
    const source = CANCELLED_BY_LABELS[obj.cancelledBy] ?? obj.cancelledBy
    return { source, reason: obj.reason ?? null }
  } catch {
    return null
  }
}

/** Map raw closedBy values to human-readable labels */
const CLOSED_BY_LABELS: Record<string, string> = {
  system: "Broker (Automatic)",
  user: "You (Manual)",
  ai_condition: "AI Condition",
  trade_finder: "Trade Finder",
}

/** Map OANDA close reason codes in event detail to friendly text */
const CLOSE_REASON_EVENT_LABELS: Record<string, string> = {
  STOP_LOSS_ORDER: "Stop loss was hit",
  TAKE_PROFIT_ORDER: "Take profit was hit",
  TRAILING_STOP_LOSS_ORDER: "Trailing stop was hit",
  MARGIN_CLOSEOUT: "Margin closeout",
  MARKET_ORDER: "Closed at market price",
}

function parseCloseDetail(
  detail: string,
): { closedBy: string; reason: string | null; pl: string | null; exitPrice: string | null } | null {
  try {
    const obj = JSON.parse(detail)
    if (!obj.closedBy && !obj.realizedPL && !obj.reason) return null

    const closedBy = CLOSED_BY_LABELS[obj.closedBy] ?? obj.closedBy ?? "Unknown"

    // Extract a friendly reason from the raw reason string
    let reason: string | null = null
    if (typeof obj.reason === "string") {
      // Try to extract OANDA close reason from the reason string
      for (const [code, label] of Object.entries(CLOSE_REASON_EVENT_LABELS)) {
        if (obj.reason.includes(code)) {
          reason = label
          break
        }
      }
      if (!reason) reason = obj.reason
    }

    const pl = obj.realizedPL != null ? String(obj.realizedPL) : null
    const exitPrice = obj.exitPrice != null ? String(obj.exitPrice) : null

    return { closedBy, reason, pl, exitPrice }
  } catch {
    return null
  }
}

function parseGenericDetail(detail: string): string {
  try {
    const obj = JSON.parse(detail)
    if (obj.message) return obj.message
    // Filter out internal / already-handled fields
    const filtered = Object.entries(obj).filter(
      ([k]) => !["time", "modifiedBy", "cancelledBy", "reason", "alreadyCancelled"].includes(k),
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

function SltpChange({
  label,
  oldVal,
  newVal,
}: {
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
      <span className="text-muted-foreground font-mono tabular-nums">{formatPrice(oldVal)}</span>
      <ArrowRight className="text-muted-foreground/50 size-3 shrink-0" />
      <span className="text-foreground font-mono font-medium tabular-nums">
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
    return <p className="text-muted-foreground py-2 text-xs">No events recorded yet.</p>
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const config = EVENT_CONFIG[event.eventType] ?? DEFAULT_CONFIG
        const Icon = config.icon
        const isLast = idx === events.length - 1
        const isSltpEvent =
          event.eventType === "SL_TP_MODIFIED" ||
          event.eventType === "SL_MODIFIED" ||
          event.eventType === "TP_MODIFIED"
        const sltpDetail = isSltpEvent ? parseSltpDetail(event.detail) : null
        const isCancelEvent = event.eventType === "ORDER_CANCELLED"
        const cancelDetail = isCancelEvent ? parseCancelDetail(event.detail) : null
        const isCloseEvent = event.eventType === "TRADE_CLOSED"
        const closeDetail = isCloseEvent ? parseCloseDetail(event.detail) : null
        const genericText =
          !sltpDetail && !cancelDetail && !closeDetail ? parseGenericDetail(event.detail) : null

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  config.bgColor,
                )}
              >
                <Icon className={cn("size-3.5", config.iconColor)} />
              </div>
              {!isLast && <div className="bg-border/50 w-px flex-1" />}
            </div>

            {/* Content */}
            <div className={cn("min-w-0 flex-1 pb-4", isLast && "pb-0")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{config.label}</span>
                <span className="text-muted-foreground whitespace-nowrap text-[10px]">
                  {formatTime(event.createdAt)}
                </span>
              </div>

              {/* SL/TP structured detail */}
              {sltpDetail && (
                <div className="bg-muted/40 mt-1.5 space-y-0.5 rounded-md px-2.5 py-1.5">
                  <SltpChange label="SL" oldVal={sltpDetail.oldSL} newVal={sltpDetail.newSL} />
                  <SltpChange label="TP" oldVal={sltpDetail.oldTP} newVal={sltpDetail.newTP} />
                </div>
              )}

              {/* Cancel detail */}
              {cancelDetail && (
                <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  <span>
                    Cancelled By:{" "}
                    <span className="text-foreground font-medium">{cancelDetail.source}</span>
                  </span>
                  {cancelDetail.reason && <span> · Reason: {cancelDetail.reason}</span>}
                </div>
              )}

              {/* Close detail */}
              {closeDetail && (
                <div className="text-muted-foreground mt-0.5 space-y-0.5 text-xs leading-relaxed">
                  <div>
                    Closed By:{" "}
                    <span className="text-foreground font-medium">{closeDetail.closedBy}</span>
                    {closeDetail.reason && <span> · {closeDetail.reason}</span>}
                  </div>
                  {(closeDetail.pl || closeDetail.exitPrice) && (
                    <div>
                      {closeDetail.exitPrice && (
                        <span>
                          Exit Price:{" "}
                          <span className="text-foreground font-medium">
                            {closeDetail.exitPrice}
                          </span>
                        </span>
                      )}
                      {closeDetail.pl && (
                        <span>
                          {closeDetail.exitPrice ? " · " : ""}Realized P&L:{" "}
                          <span
                            className={cn(
                              "font-medium",
                              parseFloat(closeDetail.pl) >= 0 ? "text-emerald-500" : "text-red-500",
                            )}
                          >
                            {parseFloat(closeDetail.pl) >= 0 ? "+" : ""}
                            {parseFloat(closeDetail.pl).toFixed(2)}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Generic detail text */}
              {genericText && (
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
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
