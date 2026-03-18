"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DataTile } from "@/components/ui/data-tile"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import {
  Zap,
  Plus,
  Settings,
  Layers,
  TrendingUp,
  DollarSign,
  Percent,
  ListChecks,
  ScrollText,
  Shield,
  Radio,
} from "lucide-react"
import { useSmartFlow } from "@/hooks/use-smart-flow"
import { TradeBuilder } from "./trade-builder"
import { ActiveTradesTab } from "./active-trades-tab"
import { ConfigsTab } from "./configs-tab"
import { ActivityTab } from "./activity-tab"
import { HealthPanel } from "./health-panel"
import { SmartFlowOnboarding } from "./smart-flow-onboarding"
import { HistoryTab } from "./history-tab"

type Tab = "trade" | "active" | "configs" | "activity" | "history" | "rankings"

export function SmartFlowDashboard() {
  const [tab, setTab] = useState<Tab>("configs") // Default to Trade Plans
  const [activityCount, setActivityCount] = useState(0)
  const { configs, activeTrades, closedTrades, isLoading, refetch } = useSmartFlow()
  const handleEventCount = useCallback((count: number) => setActivityCount(count), [])

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="space-y-6 border-b px-4 pb-8 pt-6 md:px-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const activeConfigCount = configs.filter((c) => c.isActive).length
  const hasConfigs = configs.length > 0

  // Calculate today's P&L from closed trades
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayTrades = closedTrades.filter((t) => t.closedAt && new Date(t.closedAt) >= todayStart)
  const todayPL = todayTrades.reduce((sum, _t) => {
    // TODO: wire actual P&L from linked Trade records
    return sum
  }, 0)

  // Calculate success rate from closed trades
  const recentTrades = closedTrades.slice(0, 30)
  const wins = recentTrades.filter((t) => t.safetyNetTriggered == null).length
  const successRate = recentTrades.length > 0 ? Math.round((wins / recentTrades.length) * 100) : 0

  const activeSummary =
    activeTrades.length > 0
      ? `${activeTrades.filter((t) => t.status === "waiting_entry").length} watching, ${activeTrades.filter((t) => t.status !== "waiting_entry").length} trading`
      : undefined

  return (
    <div className="min-h-screen">
      <PageHeader
        title="SmartFlow"
        subtitle="Your automated trading assistant — set up a plan and SmartFlow handles the rest"
        icon={Zap}
        bordered
        actions={
          <>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setTab("trade")}>
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New Plan</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
              <Link href="/settings/smart-flow">
                <Settings className="size-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>
          </>
        }
      >
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DataTile
            label="Trade Plans"
            value={String(activeConfigCount)}
            subtitle={activeSummary}
            icon={<Layers className="size-3" />}
            variant={activeConfigCount > 0 ? "accent" : "muted"}
          />
          <DataTile
            label="Live Trades"
            value={String(activeTrades.filter((t) => t.status !== "waiting_entry").length)}
            icon={<TrendingUp className="size-3" />}
            variant={activeTrades.length > 0 ? "accent" : "default"}
          />
          <DataTile
            label="Today's P&L"
            value={todayPL === 0 ? "--" : `$${todayPL.toFixed(2)}`}
            subtitle={
              todayTrades.length > 0
                ? `${todayTrades.length} trade${todayTrades.length > 1 ? "s" : ""} today`
                : undefined
            }
            icon={<DollarSign className="size-3" />}
            variant={todayPL > 0 ? "positive" : todayPL < 0 ? "negative" : "default"}
          />
          <DataTile
            label="Success Rate"
            value={recentTrades.length > 0 ? `${successRate}%` : "--"}
            subtitle={recentTrades.length > 0 ? `Last ${recentTrades.length} trades` : undefined}
            icon={<Percent className="size-3" />}
          />
        </div>
      </PageHeader>

      <TabNav label="SmartFlow sections">
        <TabNavButton
          active={tab === "trade"}
          onClick={() => setTab("trade")}
          icon={<Plus className="size-3.5" />}
          label="New Plan"
          count={0}
        />
        <TabNavButton
          active={tab === "active"}
          onClick={() => setTab("active")}
          icon={<ListChecks className="size-3.5" />}
          label="Active Trades"
          count={activeTrades.length}
          pulse={activeTrades.length > 0}
        />
        <TabNavButton
          active={tab === "configs"}
          onClick={() => setTab("configs")}
          icon={<Layers className="size-3.5" />}
          label="Trade Plans"
          count={configs.length}
        />
        <TabNavButton
          active={tab === "activity"}
          onClick={() => setTab("activity")}
          icon={<Radio className="size-3.5" />}
          label="Activity"
          count={activityCount}
          pulse={activityCount > 0}
        />
        <TabNavButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          icon={<ScrollText className="size-3.5" />}
          label="History"
          count={closedTrades.length}
        />
        <TabNavButton
          active={tab === "rankings"}
          onClick={() => setTab("rankings")}
          icon={<Shield className="size-3.5" />}
          label="Pair Rankings"
          count={0}
        />
      </TabNav>

      <HealthPanel />

      <div className="space-y-4 px-4 py-6 md:px-6">
        {!hasConfigs && tab === "configs" ? (
          <SmartFlowOnboarding onCreatePlan={() => setTab("trade")} />
        ) : tab === "trade" ? (
          <TradeBuilder
            onComplete={() => {
              refetch()
              setTab("configs")
            }}
          />
        ) : tab === "active" ? (
          <ActiveTradesTab trades={activeTrades} />
        ) : tab === "configs" ? (
          <ConfigsTab configs={configs} activeTrades={activeTrades} onRefresh={refetch} />
        ) : tab === "activity" ? (
          <ActivityTab activeConfigCount={activeConfigCount} onEventCount={handleEventCount} />
        ) : tab === "history" ? (
          <HistoryTab trades={closedTrades} />
        ) : (
          <TabPlaceholder tab={tab} />
        )}
      </div>
    </div>
  )
}

function TabPlaceholder({ tab }: { tab: Tab }) {
  const msgs: Record<string, string> = {
    history:
      "Closed SmartFlow trades will appear here with full details — profit/loss, duration, which protections fired, and the complete management timeline.",
    rankings:
      "Currency pair rankings will show which pairs are easiest to trade right now based on volatility, spread, trend clarity, and your past performance.",
  }
  return (
    <div className="text-muted-foreground py-12 text-center text-sm leading-relaxed">
      {msgs[tab] ?? "Coming soon."}
    </div>
  )
}
