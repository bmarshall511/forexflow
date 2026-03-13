"use client"

import type { OandaHealthData, ConnectionStatus } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { useRelativeTime } from "@/hooks/use-relative-time"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface OandaStatusPopoverProps {
  oanda: OandaHealthData | null
  isConnected: boolean
  currency?: string
}

const statusLabels: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  warning: "Warning",
  unconfigured: "Not Configured",
}

const statusColors: Record<ConnectionStatus, string> = {
  connected: "text-status-connected",
  connecting: "text-status-connecting",
  disconnected: "text-status-disconnected",
  warning: "text-status-warning",
  unconfigured: "text-muted-foreground",
}

const dotColors: Record<ConnectionStatus, string> = {
  connected: "bg-status-connected",
  connecting: "bg-status-connecting animate-pulse",
  disconnected: "bg-status-disconnected",
  warning: "bg-status-warning",
  unconfigured: "bg-status-unconfigured",
}

function CheckMark({ ok }: { ok: boolean }) {
  return (
    <span className={cn("text-xs font-medium", ok ? "text-status-connected" : "text-status-disconnected")}>
      {ok ? "\u2713" : "\u2717"}
    </span>
  )
}

export function OandaStatusPopover({ oanda, isConnected, currency = "USD" }: OandaStatusPopoverProps) {
  const lastChecked = useRelativeTime(oanda?.lastHealthCheck ?? null)

  if (!isConnected || !oanda) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">OANDA API</h4>
        <p className="text-xs text-muted-foreground">
          Daemon not connected. Start the daemon to monitor OANDA status.
        </p>
      </div>
    )
  }

  const status = oanda.status
  const marginUsage =
    oanda.balance > 0
      ? ((1 - oanda.marginAvailable / oanda.balance) * 100).toFixed(1)
      : "0.0"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", dotColors[status])} aria-hidden="true" />
          <h4 className="text-sm font-semibold">OANDA API</h4>
        </div>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColors[status])}>
          {statusLabels[status]}
        </Badge>
      </div>

      {/* Trading Mode */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Trading Mode</span>
        <span className="font-medium capitalize">{oanda.tradingMode}</span>
      </div>

      {/* Connection Details */}
      <div className="space-y-1.5 border-t border-border pt-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Connection
        </span>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">API Health</span>
            <div className="flex items-center gap-1.5">
              <CheckMark ok={oanda.apiReachable} />
              <span>{oanda.apiReachable ? "Reachable" : "Unreachable"}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Price Stream</span>
            <div className="flex items-center gap-1.5">
              <CheckMark ok={oanda.streamConnected} />
              <span>{oanda.streamConnected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Account</span>
            <div className="flex items-center gap-1.5">
              <CheckMark ok={oanda.accountValid} />
              <span>{oanda.accountValid ? "Valid" : "Invalid"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Details (only show when account is valid) */}
      {oanda.accountValid && (
        <div className="space-y-1.5 border-t border-border pt-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Account
          </span>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-mono tabular-nums">{formatCurrency(oanda.balance, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Margin Avail.</span>
              <span className="font-mono tabular-nums">{formatCurrency(oanda.marginAvailable, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Margin Usage</span>
              <span className={cn("font-mono tabular-nums", oanda.marginCallActive && "text-status-warning font-semibold")}>
                {marginUsage}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border pt-2 text-[11px] text-muted-foreground">
        Last checked {lastChecked}
      </div>

      {/* Error */}
      {oanda.errorMessage && (
        <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {oanda.errorMessage}
        </div>
      )}
    </div>
  )
}
