"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { SmartFlowActivityEvent } from "@fxflow/types"
import { formatRelativeTime } from "@fxflow/shared"
import { formatInstrument } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  Trash2,
  ChevronDown,
  Radio,
  ShieldCheck,
  TrendingUp,
  Scissors,
  ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SEVERITY_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
} as const

interface ActivityTabProps {
  activeConfigCount?: number
  onEventCount?: (count: number) => void
}

export function ActivityTab({ activeConfigCount = 0, onEventCount }: ActivityTabProps) {
  const [events, setEvents] = useState<SmartFlowActivityEvent[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/daemon/smart-flow/activity")
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        data?: SmartFlowActivityEvent[]
        events?: SmartFlowActivityEvent[]
      }
      const fetched = json.events ?? json.data ?? []
      if (json.ok && fetched.length > 0) {
        setEvents(fetched)
        onEventCount?.(fetched.length)
      }
    } catch {
      /* daemon may be down */
    }
  }, [])

  useEffect(() => {
    void fetchEvents()
    const id = setInterval(fetchEvents, 5_000)
    return () => clearInterval(id)
  }, [fetchEvents])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events.length])

  const handleClear = async () => {
    try {
      await fetch("/api/daemon/smart-flow/activity", { method: "DELETE" })
      setEvents([])
    } catch {
      /* ignore */
    }
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="mx-auto max-w-sm space-y-4 text-center">
            <div className="bg-primary/10 mx-auto flex size-10 items-center justify-center rounded-full">
              <Radio className="text-primary size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">No activity yet</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                SmartFlow activity will appear here as your trades are managed. Events show up in
                real-time as they happen.
              </p>
            </div>
            <ul className="text-muted-foreground mx-auto max-w-xs space-y-1.5 text-left text-xs">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-3 shrink-0" /> Breakeven triggers
              </li>
              <li className="flex items-center gap-2">
                <ArrowUpDown className="size-3 shrink-0" /> Trailing stop moves
              </li>
              <li className="flex items-center gap-2">
                <Scissors className="size-3 shrink-0" /> Partial close actions
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="size-3 shrink-0" /> Take profit and stop loss hits
              </li>
            </ul>
            {activeConfigCount > 0 && (
              <p className="text-muted-foreground text-xs">
                You have{" "}
                <span className="text-foreground font-medium">{activeConfigCount} active</span>{" "}
                {activeConfigCount === 1 ? "config" : "configs"}. Once trades are placed, management
                actions will appear here.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleClear}>
          <Trash2 className="size-3" />
          Clear
        </Button>
      </div>
      <div className="max-h-[600px] space-y-1 overflow-y-auto">
        {events.map((event, i) => (
          <ActivityRow key={`${event.timestamp}-${i}`} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function ActivityRow({ event }: { event: SmartFlowActivityEvent }) {
  const sev = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info
  const Icon = sev.icon
  const hasDetail = event.detail != null

  const row = (
    <div className="hover:bg-muted/50 flex items-start gap-2.5 rounded-md px-3 py-2 transition-colors">
      <div
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          sev.bg,
        )}
      >
        <Icon className={cn("size-3", sev.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {event.type}
          </Badge>
          {event.instrument && (
            <span className="text-xs font-medium">{formatInstrument(event.instrument)}</span>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{event.message}</p>
      </div>
      <span className="text-muted-foreground mt-0.5 shrink-0 text-[10px]">
        {formatRelativeTime(event.timestamp)}
      </span>
    </div>
  )

  if (!hasDetail) return row

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button type="button" className="w-full text-left">
          <div className="hover:bg-muted/50 flex items-start gap-2.5 rounded-md px-3 py-2 transition-colors">
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                sev.bg,
              )}
            >
              <Icon className={cn("size-3", sev.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {event.type}
                </Badge>
                {event.instrument && (
                  <span className="text-xs font-medium">{formatInstrument(event.instrument)}</span>
                )}
                <ChevronDown className="text-muted-foreground size-3" />
              </div>
              <p className="text-muted-foreground mt-0.5 text-[11px]">{event.message}</p>
            </div>
            <span className="text-muted-foreground mt-0.5 shrink-0 text-[10px]">
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-muted-foreground ml-10 pb-2 text-[11px]">{event.detail}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}
