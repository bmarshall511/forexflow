"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Clock, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SignalAuditEventData } from "@fxflow/db"

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  received: { label: "Received", color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  config_loaded: {
    label: "Config Loaded",
    color: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  },
  dedup_checked: {
    label: "Dedup Checked",
    color: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  },
  validated: {
    label: "Validated",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
  executing: { label: "Executing", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  executed: { label: "Executed", color: "text-green-500 bg-green-500/10 border-green-500/30" },
  rejected: { label: "Rejected", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
  failed: { label: "Failed", color: "text-red-500 bg-red-500/10 border-red-500/30" },
  post_execution: {
    label: "Post-Execution",
    color: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  },
}

function getStageConfig(stage: string) {
  return (
    STAGE_CONFIG[stage] ?? {
      label: stage,
      color: "text-slate-400 bg-slate-500/10 border-slate-500/30",
    }
  )
}

interface SignalAuditTrailProps {
  signalId: string
}

export function SignalAuditTrail({ signalId }: SignalAuditTrailProps) {
  const [events, setEvents] = useState<SignalAuditEventData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/api/tv-alerts/signals/${signalId}/audit`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.ok) {
          setEvents(data.data)
        } else {
          setError(data.error ?? "Failed to load audit trail")
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [signalId])

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-3 text-xs">
        <Loader2 className="size-3 animate-spin" />
        Loading audit trail...
      </div>
    )
  }

  if (error) {
    return <p className="py-3 text-xs text-red-500">Error: {error}</p>
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground py-3 text-xs">No audit events recorded.</p>
  }

  return (
    <div className="space-y-0.5 py-2">
      {events.map((event, i) => {
        const config = getStageConfig(event.stage)
        const isExpanded = expandedEvent === event.id
        const time = new Date(event.timestamp).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
        })
        const durationMs = event.detail.duration_ms as number | undefined
        const isLast = i === events.length - 1

        return (
          <div key={event.id} className="relative">
            {/* Timeline connector */}
            {!isLast && (
              <div className="bg-border absolute left-[11px] top-[22px] h-[calc(100%-10px)] w-px" />
            )}

            {/* Event header */}
            <button
              type="button"
              className="hover:bg-muted/50 flex w-full items-center gap-2 rounded px-1 py-1 text-left"
              onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
              aria-expanded={isExpanded}
              aria-label={`${config.label} audit event details`}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "flex size-[22px] flex-shrink-0 items-center justify-center rounded-full border",
                  config.color,
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </div>

              <Badge variant="outline" className={cn("text-[10px] font-medium", config.color)}>
                {config.label}
              </Badge>

              <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                <Clock className="size-2.5" />
                {time}
              </span>

              {durationMs !== undefined && (
                <span className="text-muted-foreground text-[10px]">+{durationMs}ms</span>
              )}

              {/* Inline summary */}
              <EventSummary event={event} />
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="bg-muted/30 mb-2 ml-[30px] mt-1 rounded border p-3">
                <pre className="text-muted-foreground overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(event.detail, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Short inline summary based on event stage and detail. */
function EventSummary({ event }: { event: SignalAuditEventData }) {
  const d = event.detail

  switch (event.stage) {
    case "received":
      return (
        <span className="text-muted-foreground truncate text-[10px]">
          {d.instrument as string} {(d.direction as string)?.toUpperCase()}
        </span>
      )

    case "validated":
      if (d.result === "rejected") {
        return (
          <span className="text-[10px] text-yellow-500">
            {(d.reason as string)?.replace(/_/g, " ")}
          </span>
        )
      }
      if (d.result === "passed") {
        return <span className="text-[10px] text-green-500">passed</span>
      }
      if (d.result === "protective_close") {
        return <span className="text-[10px] text-amber-500">protective close</span>
      }
      return null

    case "executing":
      return (
        <span className="text-muted-foreground text-[10px]">
          {d.type as string} — {d.units as number} units
        </span>
      )

    case "executed":
      return (
        <span className="text-[10px] text-green-500">
          {d.type as string}
          {d.fillPrice ? ` @ ${d.fillPrice}` : ""}
        </span>
      )

    case "failed":
      return <span className="truncate text-[10px] text-red-500">{d.error as string}</span>

    case "rejected":
      return (
        <span className="text-[10px] text-yellow-500">
          {(d.reason as string)?.replace(/_/g, " ")}
        </span>
      )

    default:
      return null
  }
}
