"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import {
  formatCountdown,
  isMarketExpectedOpen,
  getNextExpectedChange,
} from "@fxflow/shared"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

export function MarketStatus() {
  const { isConnected, market, oanda } = useDaemonStatus()
  const [now, setNow] = useState(() => new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Only trust daemon market data when OANDA stream is actively feeding it
  const trustDaemonMarket = isConnected && market && oanda?.streamConnected === true
  const open = trustDaemonMarket ? market.isOpen : isMarketExpectedOpen(now)
  const closeLabel = trustDaemonMarket && !market.isOpen ? market.closeLabel : null

  // Countdown target: from daemon if available, else client-side
  const nextChange =
    trustDaemonMarket && market.nextExpectedChange
      ? new Date(market.nextExpectedChange)
      : getNextExpectedChange(now)

  const countdown = formatCountdown(now, nextChange)
  const actionLabel = open ? "Closes" : "Opens"
  const dateTimeStr = mounted ? formatDateTime(nextChange) : "\u2014"

  // Short label for inline display
  const shortLabel = open ? "Market Open" : "Market Closed"

  // Full status label for popover
  const fullStatusLabel = open
    ? "Forex Market Open"
    : closeLabel
      ? `Market Closed \u2013 ${closeLabel}`
      : "Forex Market Closed"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="status"
          aria-label={`${fullStatusLabel}, ${actionLabel.toLowerCase()} ${dateTimeStr}`}
          className={cn(
            "hidden @lg/header:flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1",
            "hover:bg-accent/50 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              open ? "bg-status-connected" : "bg-status-disconnected",
            )}
            aria-hidden="true"
          />
          <span className="hidden @7xl/header:inline text-xs font-semibold text-foreground whitespace-nowrap">
            {shortLabel}
          </span>
          <span className="hidden @5xl/header:inline @7xl/header:hidden text-xs font-semibold text-foreground whitespace-nowrap">
            {open ? "Open" : "Closed"}
          </span>
          <span className="font-mono text-xs tabular-nums font-semibold text-foreground whitespace-nowrap">
            {mounted ? countdown : "--:--:--"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3">
          {/* Full status */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                open ? "bg-status-connected" : "bg-status-disconnected",
              )}
              aria-hidden="true"
            />
            <h4 className="text-sm font-semibold">{fullStatusLabel}</h4>
          </div>

          {/* Next change details */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{actionLabel}</span>
              <span className="font-medium">{dateTimeStr}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Countdown</span>
              <span className="font-mono tabular-nums font-semibold">
                {mounted ? countdown : "--:--:--"}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
