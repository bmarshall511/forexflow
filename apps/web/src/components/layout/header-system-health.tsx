"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { useInternetStatus } from "@/hooks/use-internet-status-context"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { OandaStatusPopover } from "./oanda-status-popover"
import { DaemonStatusPopover } from "./daemon-status-popover"
import { TVAlertsStatusPopover } from "./tv-alerts-status-popover"
import type { StatusState } from "./status-indicator"

// Priority order: higher = worse
const STATUS_PRIORITY: Record<StatusState, number> = {
  disconnected: 4,
  warning: 3,
  connecting: 2,
  unconfigured: 1,
  connected: 0,
}

const dotStyles: Record<StatusState, string> = {
  connected: "bg-status-connected",
  connecting: "bg-status-connecting animate-pulse",
  disconnected: "bg-status-disconnected",
  warning: "bg-status-warning",
  unconfigured: "bg-status-unconfigured",
}

const statusLabels: Record<StatusState, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",
  warning: "Warning",
  unconfigured: "Not configured",
}

function getWorstStatus(statuses: StatusState[]): StatusState {
  return statuses.reduce((worst, s) => (STATUS_PRIORITY[s] > STATUS_PRIORITY[worst] ? s : worst))
}

function getHealthSummary(statuses: StatusState[]): string {
  const issues = statuses.filter((s) => s !== "connected").length
  if (issues === 0) return "All systems operational"
  return `${issues} system${issues > 1 ? "s" : ""} need${issues === 1 ? "s" : ""} attention`
}

interface SystemHealthRowProps {
  label: string
  status: StatusState
  expandable?: boolean
  isOpen?: boolean
}

function SystemHealthRow({ label, status, expandable, isOpen }: SystemHealthRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", dotStyles[status])}
          aria-hidden="true"
        />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "text-[11px]",
            status === "connected" ? "text-muted-foreground" : "text-foreground font-medium",
          )}
        >
          {statusLabels[status]}
        </span>
        {expandable && (
          <ChevronDown
            className={cn(
              "text-muted-foreground size-3 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

export function HeaderSystemHealth() {
  const { isConnected, snapshot, oanda, accountOverview, tvAlertsStatus } = useDaemonStatus()
  const { isOnline, isChecking } = useInternetStatus()
  const [oandaOpen, setOandaOpen] = useState(false)
  const [daemonOpen, setDaemonOpen] = useState(false)
  const [tvAlertsOpen, setTVAlertsOpen] = useState(false)

  const internetStatus: StatusState = isOnline
    ? "connected"
    : isChecking
      ? "connecting"
      : "disconnected"

  const daemonStatus: StatusState = isConnected ? "connected" : "disconnected"
  const oandaStatus: StatusState = isConnected && oanda ? oanda.status : "disconnected"

  // TV Alerts / CF Worker status: derive from daemon-reported tvAlertsStatus
  const tvAlertsHealthStatus: StatusState = tvAlertsStatus
    ? tvAlertsStatus.cfWorkerConnected
      ? tvAlertsStatus.circuitBreakerTripped
        ? "warning"
        : "connected"
      : tvAlertsStatus.enabled
        ? "disconnected"
        : "unconfigured"
    : "unconfigured"

  const allStatuses: StatusState[] = [
    internetStatus,
    tvAlertsHealthStatus,
    oandaStatus,
    daemonStatus,
  ]
  const worstStatus = getWorstStatus(allStatuses)
  const healthSummary = getHealthSummary(allStatuses)
  const currency = accountOverview?.summary.currency

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hover:bg-accent/50 focus-visible:ring-ring flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
          aria-label={`System health: ${healthSummary}`}
        >
          <span
            className={cn("size-2.5 shrink-0 rounded-full", dotStyles[worstStatus])}
            aria-hidden="true"
          />
          <span className="@5xl/header:inline text-muted-foreground hidden whitespace-nowrap text-[11px] font-medium">
            System Health
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-1">
          <h4 className="mb-2 text-sm font-semibold">System Health</h4>

          {/* Internet */}
          <SystemHealthRow label="Internet" status={internetStatus} />

          {/* TV Alerts / CF Worker — collapsible detail */}
          <Collapsible open={tvAlertsOpen} onOpenChange={setTVAlertsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="hover:bg-accent/50 -mx-1 w-full rounded-sm px-1 transition-colors"
                aria-label={`TradingView Alerts: ${statusLabels[tvAlertsHealthStatus]}. Click to ${tvAlertsOpen ? "collapse" : "expand"} details.`}
              >
                <SystemHealthRow
                  label="TradingView Alerts"
                  status={tvAlertsHealthStatus}
                  expandable
                  isOpen={tvAlertsOpen}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-border bg-muted/30 mt-1 rounded-md border p-3">
                <TVAlertsStatusPopover tvAlerts={tvAlertsStatus} isConnected={isConnected} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* OANDA — collapsible detail */}
          <Collapsible open={oandaOpen} onOpenChange={setOandaOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="hover:bg-accent/50 -mx-1 w-full rounded-sm px-1 transition-colors"
                aria-label={`OANDA: ${statusLabels[oandaStatus]}. Click to ${oandaOpen ? "collapse" : "expand"} details.`}
              >
                <SystemHealthRow label="OANDA" status={oandaStatus} expandable isOpen={oandaOpen} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-border bg-muted/30 mt-1 rounded-md border p-3">
                <OandaStatusPopover oanda={oanda} isConnected={isConnected} currency={currency} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Daemons — collapsible detail */}
          <Collapsible open={daemonOpen} onOpenChange={setDaemonOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="hover:bg-accent/50 -mx-1 w-full rounded-sm px-1 transition-colors"
                aria-label={`Daemons: ${statusLabels[daemonStatus]}. Click to ${daemonOpen ? "collapse" : "expand"} details.`}
              >
                <SystemHealthRow
                  label="Daemons"
                  status={daemonStatus}
                  expandable
                  isOpen={daemonOpen}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-border bg-muted/30 mt-1 rounded-md border p-3">
                <DaemonStatusPopover snapshot={snapshot} isConnected={isConnected} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </PopoverContent>
    </Popover>
  )
}
