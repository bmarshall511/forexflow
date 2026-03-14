"use client"

import { Activity, Radio, TrendingUp, AlertTriangle, BarChart3, Zap } from "lucide-react"
import { DataTile } from "@/components/ui/data-tile"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { useTVAlertsConfig } from "@/hooks/use-tv-alerts-config"

export function TVAlertsStatusCards() {
  const { tvAlertsStatus, isConnected, isReachable, accountOverview } = useDaemonStatus()
  const daemonUp = isConnected || isReachable
  const { config } = useTVAlertsConfig()
  const s = tvAlertsStatus
  const currency = accountOverview?.summary?.currency ?? "USD"

  const moduleEnabled = s?.enabled ?? config?.enabled ?? false
  const cfConnected = s?.cfWorkerConnected ?? false
  const cfLabel = !daemonUp ? "No daemon" : cfConnected ? "Connected" : "Disconnected"
  const todayPL = s?.todayAutoPL ?? 0
  const circuitTripped = s?.circuitBreakerTripped ?? false

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <DataTile
        label="Module Status"
        value={moduleEnabled ? "Active" : "Disabled"}
        variant={moduleEnabled ? "positive" : "muted"}
        icon={<Activity className="size-3.5" />}
      />
      <DataTile
        label="CF Worker"
        value={cfLabel}
        variant={!daemonUp ? "muted" : cfConnected ? "positive" : "negative"}
        icon={<Radio className="size-3.5" />}
      />
      <DataTile
        label="Active Positions"
        value={s?.activeAutoPositions ?? 0}
        variant="accent"
        icon={<TrendingUp className="size-3.5" />}
      />
      <DataTile
        label="Today P&L"
        value={todayPL.toLocaleString(undefined, { style: "currency", currency })}
        variant={todayPL >= 0 ? "positive" : "negative"}
        icon={<BarChart3 className="size-3.5" />}
      />
      <DataTile
        label="Signals Today"
        value={s?.signalCountToday ?? 0}
        variant="accent"
        icon={<Zap className="size-3.5" />}
      />
      <DataTile
        label="Circuit Breaker"
        value={circuitTripped ? "TRIPPED" : "OK"}
        variant={circuitTripped ? "negative" : "positive"}
        icon={<AlertTriangle className="size-3.5" />}
      />
    </div>
  )
}
