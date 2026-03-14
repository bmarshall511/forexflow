"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { TVAlertsStatusCards } from "./tv-alerts-status-cards"
import { TVAlertsPerformance } from "./tv-alerts-performance"
import { TVAlertsSignalTable } from "./tv-alerts-signal-table"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useTVAlertsConfig } from "@/hooks/use-tv-alerts-config"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { Settings2, Zap, BarChart3, Radio } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

type Tab = "overview" | "signals"

export function TVAlertsDashboard() {
  const { config, isLoading: configLoading } = useTVAlertsConfig()
  const { tvAlertsStatus, setTVAlertsStatus } = useDaemonStatus()
  const [tab, setTab] = useState<Tab>("overview")

  const handleAfterClear = useCallback(() => {
    if (tvAlertsStatus) {
      setTVAlertsStatus({ ...tvAlertsStatus, signalCountToday: 0, lastSignalAt: null })
    }
    fetch(`${DAEMON_URL}/actions/tv-alerts/reset-signal-history`, { method: "POST" }).catch(() => {
      /* best-effort */
    })
  }, [tvAlertsStatus, setTVAlertsStatus])

  const signalCount = tvAlertsStatus?.signalCountToday ?? 0
  const isUnconfigured = !configLoading && config && !config.cfWorkerUrl && !config.webhookToken

  return (
    <div className="min-h-screen">
      <PageHeader
        title={
          <>
            <span className="lg:hidden">TV Alerts</span>
            <span className="hidden lg:inline">TradingView Alerts</span>
          </>
        }
        subtitle="Auto-trade signal monitoring and performance tracking"
        icon={Radio}
        bordered
        actions={
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link href="/settings/tv-alerts">
              <Settings2 className="size-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
        }
      >
        {!isUnconfigured && <TVAlertsStatusCards />}
      </PageHeader>

      {isUnconfigured && (
        <div className="px-4 py-6 md:px-6">
          <EmptyState
            icon={Radio}
            title="Set up TradingView webhooks to auto-trade"
            description="Configure the Cloudflare Worker relay and webhook token to start receiving TradingView alerts."
            action={{ label: "Configure TV Alerts", href: "/settings/tv-alerts" }}
          />
        </div>
      )}

      {!isUnconfigured && (
        <>
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

          <div className="space-y-4 px-4 py-6 md:px-6">
            {tab === "overview" && <TVAlertsPerformance />}
            {tab === "signals" && <TVAlertsSignalTable onStatsRefresh={handleAfterClear} />}
          </div>
        </>
      )}
    </div>
  )
}
