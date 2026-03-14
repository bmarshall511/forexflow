"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarDays, AlertCircle, Clock } from "lucide-react"
import { useCalendar } from "@/hooks/use-calendar"
import type { EconomicEventData, EconomicEventImpact } from "@fxflow/types"
import { cn } from "@/lib/utils"

// ─── Helpers ────────────────────────────────────────────────────────────────

function impactBadge(impact: EconomicEventImpact) {
  const variants: Record<EconomicEventImpact, { label: string; className: string }> = {
    high: { label: "High", className: "border-red-500/30 bg-red-500/10 text-red-600" },
    medium: { label: "Med", className: "border-amber-500/30 bg-amber-500/10 text-amber-600" },
    low: { label: "Low", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" },
  }
  const v = variants[impact]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1 py-0.5 text-[10px] font-medium leading-none",
        v.className,
      )}
    >
      {v.label}
    </span>
  )
}

function formatCountdown(isoTimestamp: string): string {
  const diff = new Date(isoTimestamp).getTime() - Date.now()
  if (diff <= 0) return "Now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (hours < 24) return remainMinutes > 0 ? `${hours}h ${remainMinutes}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`
}

function formatEventTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

// ─── Event row ──────────────────────────────────────────────────────────────

function EventRow({ event }: { event: EconomicEventData }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5 text-xs">
      {impactBadge(event.impact)}
      <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-medium">
        {event.currency}
      </span>
      <span className="min-w-0 flex-1 truncate" title={event.title}>
        {event.title}
      </span>
      <span className="text-muted-foreground shrink-0 tabular-nums">
        {formatEventTime(event.timestamp)}
      </span>
      <span className="text-muted-foreground/60 w-12 shrink-0 text-right tabular-nums">
        {formatCountdown(event.timestamp)}
      </span>
    </div>
  )
}

// ─── Main card ──────────────────────────────────────────────────────────────

const MAX_DISPLAY_EVENTS = 5

export function CalendarCard() {
  const { events, isLoading, error } = useCalendar(48)

  // Show high-impact first, then medium, capped at MAX_DISPLAY_EVENTS
  const displayEvents = useMemo(() => {
    const highImpact = events.filter((e) => e.impact === "high")
    const medImpact = events.filter((e) => e.impact === "medium")
    const combined = [...highImpact, ...medImpact]
    return combined.slice(0, MAX_DISPLAY_EVENTS)
  }, [events])

  const highCount = useMemo(() => events.filter((e) => e.impact === "high").length, [events])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          Economic Calendar
          {highCount > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
              {highCount} high-impact
            </Badge>
          )}
        </CardTitle>
        <CardAction>
          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
            <Clock className="size-3" />
            48h
          </span>
        </CardAction>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2" role="status" aria-label="Loading calendar events">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <AlertCircle className="text-destructive size-5" />
            <p className="text-muted-foreground text-xs">Failed to load calendar events</p>
          </div>
        ) : displayEvents.length === 0 ? (
          <div className="space-y-2 rounded-lg border border-dashed p-4 text-center">
            <CalendarDays className="text-muted-foreground mx-auto size-6" />
            <p className="text-muted-foreground text-sm">No upcoming events</p>
            <p className="text-muted-foreground/60 text-xs">
              {events.length === 0
                ? "No economic events found. Events are fetched from Finnhub every 4 hours."
                : "No high or medium impact events in the next 48 hours"}
            </p>
          </div>
        ) : (
          <div className="divide-border divide-y">
            {displayEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
            {events.length > MAX_DISPLAY_EVENTS && (
              <p className="text-muted-foreground/60 pt-2 text-center text-[10px]">
                +{events.length - MAX_DISPLAY_EVENTS} more events in the next 48h
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
