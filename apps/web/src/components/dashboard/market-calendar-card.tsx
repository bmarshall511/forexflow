"use client"

import { useMemo } from "react"
import Link from "next/link"
import { CalendarDays, AlertTriangle, AlertCircle, type LucideIcon } from "lucide-react"
import type { EconomicEventData } from "@fxflow/types"
import { useCalendar } from "@/hooks/use-calendar"
import { usePositions } from "@/hooks/use-positions"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionCard } from "@/components/dashboard/shared"
import { cn } from "@/lib/utils"

/**
 * What's next — condensed calendar rail.
 *
 * The prior MarketCalendarCard was a 5-row list inside a bulky `Card`
 * primitive. In the redesigned dashboard it read as "another analytics
 * card" rather than ambient context. This rewrite keeps the important
 * signal (high/medium impact events that can move a trade) but compresses
 * to **at most 5 rows** with a strong top-line urgency banner when
 * anything ≤4h away is high-impact. Relevance highlighting is preserved —
 * events tied to a currency in an open position get a subtle accent ring.
 *
 * Visual shell: shared `SectionCard` so it sits next to Depth Sections,
 * Live Trades, and Activity Feed without introducing a fourth chrome.
 */
const MAX_EVENTS = 5

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

const IMPACT_STYLE = {
  high: {
    label: "High",
    badge: "border-status-disconnected/30 bg-status-disconnected/10 text-status-disconnected",
  },
  medium: {
    label: "Med",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  low: {
    label: "Low",
    badge: "border-status-connected/30 bg-status-connected/10 text-status-connected",
  },
} as const

function UrgencyBanner({ event }: { event: EconomicEventData }) {
  const diff = new Date(event.timestamp).getTime() - Date.now()
  if (diff < 0 || diff > 4 * 60 * 60 * 1000) return null
  const isImminent = diff < 60 * 60 * 1000
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
        isImminent
          ? "bg-status-disconnected/10 text-status-disconnected"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{event.currency}</span>
        <span className="mx-1 opacity-70">·</span>
        <span className="truncate">{event.title}</span>
      </div>
      <span className="shrink-0 font-mono tabular-nums">{formatCountdown(event.timestamp)}</span>
    </div>
  )
}

function EventRow({ event, isRelevant }: { event: EconomicEventData; isRelevant: boolean }) {
  const impact = IMPACT_STYLE[event.impact]
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-1.5 py-1.5 text-xs",
        isRelevant && "ring-primary/20 bg-primary/5 ring-1",
      )}
    >
      <span
        aria-label={`${impact.label} impact`}
        className={cn(
          "inline-flex shrink-0 items-center rounded border px-1 py-0.5 text-[10px] font-medium leading-none",
          impact.badge,
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
      <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
        {formatTime(event.timestamp)}
      </span>
      <span className="text-muted-foreground/60 w-14 shrink-0 text-right text-[11px] tabular-nums">
        {formatCountdown(event.timestamp)}
      </span>
    </div>
  )
}

export function MarketCalendarCard() {
  const { events, isLoading, error } = useCalendar(48)
  const { openWithPrices } = usePositions()

  const activeCurrencies = useMemo(() => {
    const s = new Set<string>()
    for (const t of openWithPrices) {
      const [base, quote] = t.instrument.split("_")
      if (base) s.add(base)
      if (quote) s.add(quote)
    }
    return s
  }, [openWithPrices])

  const displayEvents = useMemo(() => {
    return [...events]
      .filter((e) => e.impact === "high" || e.impact === "medium")
      .sort((a, b) => {
        if (a.impact === "high" && b.impact !== "high") return -1
        if (a.impact !== "high" && b.impact === "high") return 1
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      })
      .slice(0, MAX_EVENTS)
  }, [events])

  const nextUrgent = useMemo(
    () => events.find((e) => e.impact === "high" && new Date(e.timestamp).getTime() > Date.now()),
    [events],
  )

  const highCount = useMemo(() => events.filter((e) => e.impact === "high").length, [events])

  const action = (
    <Link
      href="/alerts"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring text-[11px] transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2"
    >
      View full →
    </Link>
  )

  return (
    <SectionCard
      icon={<CalendarDays className="size-4" />}
      title="What's next"
      meta={
        !isLoading && events.length > 0
          ? highCount > 0
            ? `${highCount} high · 48h`
            : "Next 48h"
          : undefined
      }
      action={action}
    >
      {nextUrgent && <UrgencyBanner event={nextUrgent} />}

      {isLoading ? (
        <SkeletonRows />
      ) : error ? (
        <ErrorState />
      ) : displayEvents.length === 0 ? (
        <ClearSkies />
      ) : (
        <ul className="divide-border/40 divide-y">
          {displayEvents.map((event) => (
            <li key={event.id}>
              <EventRow event={event} isRelevant={activeCurrencies.has(event.currency)} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading calendar">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  )
}

function ErrorState() {
  return <EmptyCentered Icon={AlertCircle} title="Failed to load calendar" tone="destructive" />
}

function ClearSkies() {
  return (
    <EmptyCentered
      Icon={CalendarDays}
      title="Clear skies"
      subtitle="No high or medium impact events in the next 48 hours"
    />
  )
}

function EmptyCentered({
  Icon,
  title,
  subtitle,
  tone,
}: {
  Icon: LucideIcon
  title: string
  subtitle?: string
  tone?: "destructive"
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
      <Icon
        className={cn(
          "size-6",
          tone === "destructive" ? "text-status-disconnected" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{title}</p>
      {subtitle && <p className="text-muted-foreground/70 max-w-xs text-xs">{subtitle}</p>}
    </div>
  )
}
