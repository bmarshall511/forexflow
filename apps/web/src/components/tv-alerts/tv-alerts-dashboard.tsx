"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { TVAlertsStatusCards } from "./tv-alerts-status-cards"
import { TVAlertsPerformance } from "./tv-alerts-performance"
import { TVAlertsSignalTable } from "./tv-alerts-signal-table"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { Button } from "@/components/ui/button"
import { useTVAlertsStats } from "@/hooks/use-tv-alerts-stats"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { Settings2, Zap, BarChart3 } from "lucide-react"
import type { TVAlertSignal } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

type Tab = "overview" | "signals"

export function TVAlertsDashboard() {
  const { stats, isLoading: statsLoading, refresh: refreshStats } = useTVAlertsStats()
  const { lastTVSignal, tvAlertsStatus, setTVAlertsStatus } = useDaemonStatus()
  const lastSignalRef = useRef<TVAlertSignal | null>(null)
  const [tab, setTab] = useState<Tab>("overview")

  // Refresh stats whenever a new signal arrives via WebSocket
  useEffect(() => {
    if (!lastTVSignal || lastTVSignal === lastSignalRef.current) return
    lastSignalRef.current = lastTVSignal
    void refreshStats()
  }, [lastTVSignal, refreshStats])

  // Called by TVAlertsSignalTable after clearing signal history.
  const handleAfterClear = useCallback(() => {
    void refreshStats()
    if (tvAlertsStatus) {
      setTVAlertsStatus({ ...tvAlertsStatus, signalCountToday: 0, lastSignalAt: null })
    }
    fetch(`${DAEMON_URL}/actions/tv-alerts/reset-signal-history`, { method: "POST" })
      .catch(() => { /* best-effort */ })
  }, [refreshStats, tvAlertsStatus, setTVAlertsStatus])

  const signalCount = tvAlertsStatus?.signalCountToday ?? 0

  return (
    <div className="min-h-screen">
      {/* ─── Hero Header ─── */}
      <div className="px-4 md:px-6 pt-6 pb-8 border-b">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="lg:hidden">TV Alerts</span>
              <span className="hidden lg:inline">TradingView Alerts</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Auto-trade signal monitoring and performance tracking
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 shrink-0" asChild>
            <Link href="/settings/tv-alerts">
              <Settings2 className="size-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
        </div>

        <TVAlertsStatusCards />
      </div>

      {/* ─── Tab Navigation ─── */}
      <TabNav label="TV Alerts sections">
        <TabNavButton
          active={tab === "overview"}
          onClick={() => setTab("overview")}
          icon={<BarChart3 className="size-3.5" />}
          label="Performance"
          count={0}
        />
        <TabNavButton
          active={tab === "signals"}
          onClick={() => setTab("signals")}
          icon={<Zap className="size-3.5" />}
          label="Signals"
          count={signalCount}
          pulse={signalCount > 0}
        />
      </TabNav>

      {/* ─── Tab Content ─── */}
      <div className="px-4 md:px-6 py-6 space-y-4">
        {tab === "overview" && (
          <TVAlertsPerformance stats={stats} isLoading={statsLoading} />
        )}
        {tab === "signals" && (
          <TVAlertsSignalTable onStatsRefresh={handleAfterClear} />
        )}
      </div>
    </div>
  )
}
