"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Sunrise, Sunset, Moon } from "lucide-react"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { useCalendar } from "@/hooks/use-calendar"
import { cn } from "@/lib/utils"

/**
 * Day brief — the first thing the user sees. One short line anchoring the
 * rest of the dashboard in the current moment. The old greeting card had
 * duplicate mobile/desktop copy paths and three floating pills that never
 * quite lined up; this rewrite collapses to a single strip that reflows
 * naturally and shares the SectionCard-adjacent visual weight of Live
 * Strip without a heavy card border (this row is ambient context, not data).
 *
 * Surfaces only:
 *   - time-of-day greeting (icon swaps: sunrise / sun / sunset / moon)
 *   - market status pill (open/closed + live-pulse dot when open)
 *   - next-boundary countdown — whichever is sooner of:
 *       · next high-impact calendar event (<24h)
 *       · next market open/close transition
 *   - open-position count when non-zero (blue pill)
 *
 * All WS-reactive via `useDaemonStatus` and `usePositions`. Countdown ticks
 * via a 30-second interval; long enough to be cheap, short enough that
 * "in 3m" doesn't sit stale on the screen for minutes at a time.
 */
function useTick(intervalMs: number): number {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return 0
}

function getGreeting(hour: number): { text: string; Icon: typeof Sunrise } {
  if (hour < 6) return { text: "Good evening", Icon: Moon }
  if (hour < 12) return { text: "Good morning", Icon: Sunrise }
  if (hour < 17) return { text: "Good afternoon", Icon: Sunrise }
  if (hour < 21) return { text: "Good evening", Icon: Sunset }
  return { text: "Good night", Icon: Moon }
}

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`
}

export function GreetingBar() {
  useTick(30_000)
  const { market, isConnected, isReachable } = useDaemonStatus()
  const daemonUp = isConnected || isReachable
  const { summary } = usePositions()
  const { events } = useCalendar(24)

  const { text: greeting, Icon: GreetingIcon } = useMemo(
    () => getGreeting(new Date().getHours()),
    [],
  )

  const nextHighImpact = useMemo(
    () => events.find((e) => e.impact === "high" && new Date(e.timestamp).getTime() > Date.now()),
    [events],
  )

  /** Short context clause after the greeting. Single source of truth —
   *  never renders a duplicate mobile copy. */
  const context = useMemo(() => {
    if (!daemonUp) return "Connecting to trading system…"
    if (!market) return "Loading market status…"
    if (market.isOpen) {
      if (summary.openCount > 0) {
        return `${summary.openCount} trade${summary.openCount !== 1 ? "s" : ""} live`
      }
      return "Markets are open"
    }
    if (market.nextExpectedChange) {
      return `Markets closed — opens in ${formatCountdown(market.nextExpectedChange)}`
    }
    return "Markets closed"
  }, [daemonUp, market, summary.openCount])

  const isImpactSoon =
    nextHighImpact && new Date(nextHighImpact.timestamp).getTime() - Date.now() < 4 * 60 * 60 * 1000

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-6 md:px-6",
        "animate-in fade-in duration-500",
      )}
    >
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <GreetingIcon className="text-muted-foreground size-5 self-center" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{greeting}</h1>
        <span className="text-muted-foreground min-w-0 truncate text-sm">— {context}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {market && (
          <span
            role="status"
            aria-label={market.isOpen ? "Market is open" : "Market is closed"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              market.isOpen
                ? "border-status-connected/30 bg-status-connected/10 text-status-connected"
                : "border-muted-foreground/30 bg-muted text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                market.isOpen
                  ? "bg-status-connected motion-safe:animate-pulse"
                  : "bg-muted-foreground",
              )}
            />
            {market.isOpen ? "Market open" : "Closed"}
          </span>
        )}

        {isImpactSoon && nextHighImpact && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3" aria-hidden="true" />
            <span className="font-mono tabular-nums">{nextHighImpact.currency}</span>
            in {formatCountdown(nextHighImpact.timestamp)}
          </span>
        )}
      </div>
    </div>
  )
}
