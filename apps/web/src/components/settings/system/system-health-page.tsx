"use client"

import { useSystemHealth } from "@/hooks/use-system-health"
import { DaemonHealthCard } from "./daemon-health-card"
import { OandaHealthCard } from "./oanda-health-card"
import { StorageStatsCard } from "./storage-stats-card"
import { ServicesStatusCard } from "./services-status-card"
import { VersionInfoCard } from "./version-info-card"
import type { OandaHealthData } from "@fxflow/types"

export function SystemHealthPage() {
  const { health, loading, lastRefresh, isConnected, oanda, snapshot } = useSystemHealth()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">System Health</h2>
        <p className="text-muted-foreground text-sm">
          Live status of daemon, OANDA connection, services, and database storage.
        </p>
        {lastRefresh && (
          <p className="text-muted-foreground/60 mt-1 text-[10px]">
            Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refreshes every 30s)
          </p>
        )}
      </div>

      {loading && !health ? (
        <div className="text-muted-foreground py-8 text-center text-sm">Loading health data...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <DaemonHealthCard
            daemon={health?.daemon ?? null}
            daemonReachable={health?.daemonReachable ?? false}
            wsConnected={isConnected}
          />
          <OandaHealthCard oanda={oanda as OandaHealthData | null} />
          <ServicesStatusCard daemon={health?.daemon ?? null} snapshot={snapshot} />
          <StorageStatsCard storage={health?.storage ?? null} />
          <VersionInfoCard />
        </div>
      )}
    </div>
  )
}
