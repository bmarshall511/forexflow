"use client"

import { useMemo } from "react"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { useCalendar } from "@/hooks/use-calendar"
import { cn } from "@/lib/utils"
import { Clock, AlertTriangle, TrendingUp } from "lucide-react"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatCountdown(isoTimestamp: string): string {
  const diff = new Date(isoTimestamp).getTime() - Date.now()
  if (diff <= 0) return "now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  if (remHours === 0) return `${days}d`
  return `${days}d ${remHours}h`
}

export function GreetingBar() {
  const { market, isConnected, isReachable } = useDaemonStatus()
  const daemonUp = isConnected || isReachable
  const { summary } = usePositions()
  const { events } = useCalendar(48)

  const nextHighImpact = useMemo(
    () => events.find((e) => e.impact === "high" && new Date(e.timestamp).getTime() > Date.now()),
    [events],
  )

  const isHighImpactSoon = useMemo(
    () =>
      nextHighImpact
        ? new Date(nextHighImpact.timestamp).getTime() - Date.now() < 4 * 60 * 60 * 1000
        : false,
    [nextHighImpact],
  )

  const contextMessage = useMemo(() => {
    if (!daemonUp) return "Connecting to trading system…"
    if (!market) return "Loading market status…"

    if (market.isOpen) {
      if (summary.openCount > 0) {
        return `You have ${summary.openCount} active trade${summary.openCount !== 1 ? "s" : ""}`
      }
      return "Markets are open — looking for opportunities"
    }

    if (market.nextExpectedChange) {
      return `Markets closed — opens in ${formatCountdown(market.nextExpectedChange)}`
    }
    return `Markets closed${market.closeLabel ? ` — ${market.closeLabel}` : ""}`
  }, [daemonUp, market, summary.openCount])

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 pt-6 md:px-6",
        "animate-in fade-in duration-500",
      )}
    >
      {/* Greeting + context */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{getGreeting()}</h1>
        <span className="text-muted-foreground hidden text-sm sm:inline">— {contextMessage}</span>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2">
        {/* Market status pill */}
        {market && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              market.isOpen
                ? "border-status-connected/30 bg-status-connected/10 text-status-connected"
                : "border-muted-foreground/30 bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                market.isOpen ? "bg-status-connected animate-pulse" : "bg-muted-foreground",
              )}
            />
            {market.isOpen ? "Market Open" : "Closed"}
          </span>
        )}

        {/* High-impact event warning */}
        {isHighImpactSoon && nextHighImpact && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            <span className="hidden sm:inline">{nextHighImpact.currency}</span>
            in {formatCountdown(nextHighImpact.timestamp)}
          </span>
        )}

        {/* Open trade count (mobile: shows context that's hidden above) */}
        {summary.openCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 sm:hidden dark:text-blue-400">
            <TrendingUp className="size-3" />
            {summary.openCount} open
          </span>
        )}
      </div>

      {/* Mobile context line */}
      <p className="text-muted-foreground w-full text-xs sm:hidden">{contextMessage}</p>
    </div>
  )
}
