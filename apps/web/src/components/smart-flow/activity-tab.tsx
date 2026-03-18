"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { SmartFlowActivityEvent } from "@fxflow/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, Radio, ShieldCheck, ArrowUpDown, TrendingUp, Scissors } from "lucide-react"
import { cn } from "@/lib/utils"
import { ActivityEventRow } from "./activity-event-row"

type Filter = "all" | "trades" | "management" | "system"

const TRADE_TYPES = new Set([
  "entry_placed",
  "entry_filled",
  "entry_blocked",
  "entry_delayed_spread",
  "entry_watching",
  "entry_progress",
  "entry_triggered",
  "entry_expired",
  "trade_closed",
])
const MGMT_TYPES = new Set([
  "breakeven_set",
  "trailing_activated",
  "trailing_moved",
  "partial_close",
  "safety_net_triggered",
])
const SYS_TYPES = new Set([
  "engine_started",
  "engine_stopped",
  "config_created",
  "config_activated",
  "config_deactivated",
  "config_deleted",
  "monitoring_update",
  "market_status",
  "tick_subscribed",
  "tick_unsubscribed",
])

interface ActivityTabProps {
  activeConfigCount?: number
  onEventCount?: (count: number) => void
}

export function ActivityTab({ activeConfigCount = 0, onEventCount }: ActivityTabProps) {
  const [events, setEvents] = useState<SmartFlowActivityEvent[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
  }, [onEventCount])

  // Initial fetch + polling fallback (reduced to 15s — WS handles real-time)
  useEffect(() => {
    void fetchEvents()
    const id = setInterval(fetchEvents, 15_000)
    return () => clearInterval(id)
  }, [fetchEvents])

  // Listen for WebSocket activity events dispatched by use-daemon-connection
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as SmartFlowActivityEvent
      if (detail?.id) {
        setEvents((prev) => {
          if (prev.some((ev) => ev.id === detail.id)) return prev
          const next = [...prev, detail]
          if (next.length > 200) next.shift()
          return next
        })
      }
    }
    window.addEventListener("smart-flow-activity", handler)
    return () => window.removeEventListener("smart-flow-activity", handler)
  }, [])

  // Sync event count to parent
  useEffect(() => {
    onEventCount?.(events.length)
  }, [events.length, onEventCount])

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events.length])

  const handleClear = async () => {
    try {
      await fetch("/api/daemon/smart-flow/activity", { method: "DELETE" })
      setEvents([])
      onEventCount?.(0)
    } catch {
      /* ignore */
    }
  }

  const filtered = events.filter((e) => {
    if (filter === "all") return true
    if (filter === "trades") return TRADE_TYPES.has(e.type)
    if (filter === "management") return MGMT_TYPES.has(e.type)
    return SYS_TYPES.has(e.type)
  })

  const grouped = groupByDay(filtered)

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
                SmartFlow activity will appear here in real-time as your trades are managed.
              </p>
            </div>
            <ul className="text-muted-foreground mx-auto max-w-xs space-y-1.5 text-left text-xs">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-3 shrink-0" /> Break-even triggers
              </li>
              <li className="flex items-center gap-2">
                <ArrowUpDown className="size-3 shrink-0" /> Trailing stop moves
              </li>
              <li className="flex items-center gap-2">
                <Scissors className="size-3 shrink-0" /> Partial close actions
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="size-3 shrink-0" /> Trade entries and exits
              </li>
            </ul>
            {activeConfigCount > 0 && (
              <p className="text-muted-foreground text-xs">
                You have{" "}
                <span className="text-foreground font-medium">{activeConfigCount} active</span>{" "}
                trade plan{activeConfigCount > 1 ? "s" : ""}. Activity will appear once trades are
                placed.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["all", "trades", "management", "system"] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 text-[11px] capitalize")}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleClear}>
          <Trash2 className="size-3" /> Clear
        </Button>
      </div>
      <div ref={containerRef} className="max-h-[600px] space-y-0.5 overflow-y-auto">
        {grouped.map(([label, items]) => (
          <div key={label}>
            <div className="bg-background/80 sticky top-0 z-10 px-2 py-1.5 backdrop-blur-sm">
              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                {label}
              </span>
            </div>
            {items.map((event, i) => (
              <ActivityEventRow key={event.id ?? `${event.timestamp}-${i}`} event={event} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function groupByDay(events: SmartFlowActivityEvent[]): [string, SmartFlowActivityEvent[]][] {
  const groups = new Map<string, SmartFlowActivityEvent[]>()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const event of events) {
    const date = new Date(event.timestamp)
    let label: string
    if (date.toDateString() === today.toDateString()) label = "Today"
    else if (date.toDateString() === yesterday.toDateString()) label = "Yesterday"
    else label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })

    const group = groups.get(label) ?? []
    group.push(event)
    groups.set(label, group)
  }

  return [...groups.entries()]
}
