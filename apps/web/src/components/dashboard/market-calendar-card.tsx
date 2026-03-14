"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useCalendar } from "@/hooks/use-calendar"
import { usePositions } from "@/hooks/use-positions"
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CalendarDays, AlertTriangle, Clock, AlertCircle } from "lucide-react"
import type { EconomicEventData, EconomicEventImpact } from "@fxflow/types"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCountdown(isoTimestamp: string): string {
  const diff = new Date(isoTimestamp).getTime() - Date.now()
  if (diff <= 0) return "Now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function formatEventTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

const impactStyles: Record<EconomicEventImpact, { label: string; className: string }> = {
  high: {
    label: "High",
    className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  medium: {
    label: "Med",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  low: {
    label: "Low",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
}

// ─── Urgency banner ─────────────────────────────────────────────────────────

function UrgencyBanner({ event }: { event: EconomicEventData }) {
  const timeLeft = new Date(event.timestamp).getTime() - Date.now()
  const isImminent = timeLeft < 60 * 60 * 1000 // < 1 hour
  const isSoon = timeLeft < 4 * 60 * 60 * 1000 // < 4 hours

  if (!isSoon) return null

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
        isImminent
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      <AlertTriangle className="size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{event.currency}</span>
        <span className="mx-1">·</span>
        <span className="truncate">{event.title}</span>
      </div>
      <span className="shrink-0 font-mono tabular-nums">{formatCountdown(event.timestamp)}</span>
    </div>
  )
}

// ─── Event row ──────────────────────────────────────────────────────────────

function EventRow({ event, isRelevant }: { event: EconomicEventData; isRelevant: boolean }) {
  const impact = impactStyles[event.impact]

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1 py-1.5 text-xs",
        isRelevant && "bg-primary/5 rounded",
      )}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded border px-1 py-0.5 text-[10px] font-medium leading-none",
          impact.className,
        )}
      >
        {impact.label}
      </span>
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

const MAX_EVENTS = 5

export function MarketCalendarCard() {
  const { events, isLoading, error } = useCalendar(48)
  const { openWithPrices } = usePositions()

  // Currencies in open positions (for relevance highlighting)
  const activeCurrencies = useMemo(() => {
    const currencies = new Set<string>()
    for (const t of openWithPrices) {
      const [base, quote] = t.instrument.split("_")
      if (base) currencies.add(base)
      if (quote) currencies.add(quote)
    }
    return currencies
  }, [openWithPrices])

  // Sort: high first, then medium
  const displayEvents = useMemo(() => {
    const sorted = [...events]
      .filter((e) => e.impact === "high" || e.impact === "medium")
      .sort((a, b) => {
        if (a.impact === "high" && b.impact !== "high") return -1
        if (a.impact !== "high" && b.impact === "high") return 1
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      })
    return sorted.slice(0, MAX_EVENTS)
  }, [events])

  // Next high-impact event for urgency banner
  const nextUrgent = useMemo(
    () => events.find((e) => e.impact === "high" && new Date(e.timestamp).getTime() > Date.now()),
    [events],
  )

  const highCount = useMemo(() => events.filter((e) => e.impact === "high").length, [events])

  return (
    <Card
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: "300ms" }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarDays className="size-4" />
          Market Calendar
          {highCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
              {highCount} high
            </span>
          )}
        </CardTitle>
        <CardAction>
          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
            <Clock className="size-3" />
            48h
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Urgency banner */}
        {nextUrgent && <UrgencyBanner event={nextUrgent} />}

        {/* Event list */}
        {isLoading ? (
          <div className="space-y-2" role="status" aria-label="Loading calendar">
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
            <p className="text-muted-foreground text-xs">Failed to load calendar</p>
          </div>
        ) : displayEvents.length === 0 ? (
          <div className="space-y-1 rounded-lg border border-dashed p-4 text-center">
            <CalendarDays className="text-muted-foreground mx-auto size-6" />
            <p className="text-muted-foreground text-sm">Clear skies</p>
            <p className="text-muted-foreground/60 text-xs">
              No high or medium impact events in the next 48 hours
            </p>
          </div>
        ) : (
          <div className="divide-border/50 divide-y">
            {displayEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isRelevant={activeCurrencies.has(event.currency)}
              />
            ))}
          </div>
        )}

        {events.length > MAX_EVENTS && (
          <p className="text-muted-foreground/60 text-center text-[10px]">
            +{events.length - MAX_EVENTS} more events
          </p>
        )}
      </CardContent>

      <CardFooter>
        <Link
          href="/alerts"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          View full calendar →
        </Link>
      </CardFooter>
    </Card>
  )
}
