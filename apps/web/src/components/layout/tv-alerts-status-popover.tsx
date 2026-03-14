"use client"

import Link from "next/link"
import type { TVAlertsStatusData } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TVAlertsStatusPopoverProps {
  tvAlerts: TVAlertsStatusData | null
  isConnected: boolean
}

export function TVAlertsStatusPopover({ tvAlerts, isConnected }: TVAlertsStatusPopoverProps) {
  if (!isConnected || !tvAlerts) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">TradingView Alerts</h4>
        <p className="text-muted-foreground text-xs">
          {!isConnected ? (
            "Daemon not connected. TradingView Alerts status unavailable."
          ) : (
            <>
              CF Worker not configured.{" "}
              <Link href="/settings/tv-alerts" className="hover:text-foreground underline">
                Configure in Settings
              </Link>
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">TradingView Alerts</h4>
        <Badge
          variant="outline"
          className={cn(
            "px-1.5 py-0 text-[10px]",
            tvAlerts.enabled ? "text-status-connected" : "text-muted-foreground",
          )}
        >
          {tvAlerts.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      {/* Connection details */}
      <div className="border-border space-y-1.5 border-t pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">CF Worker</span>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 rounded-full",
                tvAlerts.cfWorkerConnected ? "bg-status-connected" : "bg-status-disconnected",
              )}
              aria-hidden="true"
            />
            <span>{tvAlerts.cfWorkerConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Active Positions</span>
          <span className="font-medium">{tvAlerts.activeAutoPositions}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Signals Today</span>
          <span className="font-medium">{tvAlerts.signalCountToday}</span>
        </div>
      </div>

      {/* Safety */}
      <div className="border-border space-y-1.5 border-t pt-2">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
          Safety
        </span>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Today P&L</span>
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              tvAlerts.todayAutoPL >= 0 ? "text-green-500" : "text-red-500",
            )}
          >
            ${tvAlerts.todayAutoPL.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Circuit Breaker</span>
          <span
            className={cn(
              "font-medium",
              tvAlerts.circuitBreakerTripped ? "text-red-500" : "text-green-500",
            )}
          >
            {tvAlerts.circuitBreakerTripped ? "TRIPPED" : "OK"}
          </span>
        </div>
        {tvAlerts.lastSignalAt && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last Signal</span>
            <span>{new Date(tvAlerts.lastSignalAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}
