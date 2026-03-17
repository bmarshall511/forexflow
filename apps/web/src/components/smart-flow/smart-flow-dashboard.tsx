"use client"

import { useState } from "react"
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
  Clock,
  ListChecks,
  ScrollText,
  Shield,
} from "lucide-react"
import { useSmartFlow } from "@/hooks/use-smart-flow"

type Tab = "trade" | "active" | "configs" | "history" | "rankings"

export function SmartFlowDashboard() {
  const [tab, setTab] = useState<Tab>("trade")
  const { configs, activeTrades, closedTrades, isLoading } = useSmartFlow()

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
  const todayPL = 0 // Will be derived from WS status data later
  const avgHrs =
    closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0) / closedTrades.length
      : 0
  const fmtHrs = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`)

  return (
    <div className="min-h-screen">
      <PageHeader
        title="SmartFlow"
        subtitle="Smart, managed trades that work toward profit"
        icon={Zap}
        bordered
        actions={
          <>
            <Button size="sm" className="h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New Trade</span>
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
            label="Active Configs"
            value={String(activeConfigCount)}
            icon={<Layers className="size-3" />}
            variant={activeConfigCount > 0 ? "accent" : "muted"}
          />
          <DataTile
            label="Open Trades"
            value={String(activeTrades.length)}
            icon={<TrendingUp className="size-3" />}
            variant={activeTrades.length > 0 ? "accent" : "default"}
          />
          <DataTile
            label="Today's P&L"
            value={`$${todayPL.toFixed(2)}`}
            icon={<DollarSign className="size-3" />}
            variant={todayPL > 0 ? "positive" : todayPL < 0 ? "negative" : "default"}
          />
          <DataTile
            label="Avg Completion"
            value={closedTrades.length > 0 ? fmtHrs(avgHrs) : "--"}
            icon={<Clock className="size-3" />}
          />
        </div>
      </PageHeader>

      <TabNav label="SmartFlow sections">
        <TabNavButton
          active={tab === "trade"}
          onClick={() => setTab("trade")}
          icon={<Zap className="size-3.5" />}
          label="Trade"
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
          label="Configurations"
          count={configs.length}
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

      <div className="space-y-4 px-4 py-6 md:px-6">
        <TabPlaceholder tab={tab} />
      </div>
    </div>
  )
}

const tabPlaceholders: Record<Tab, string> = {
  trade: "Trade builder coming in Phase 3b",
  active: "Active SmartFlow trade cards will appear here once trades are running.",
  configs: "Saved trade configurations will be listed here.",
  history: "Closed SmartFlow trade history will appear here.",
  rankings: "Pair safety scores and rankings will be displayed here.",
}

function TabPlaceholder({ tab }: { tab: Tab }) {
  return (
    <div className="text-muted-foreground py-12 text-center text-sm">{tabPlaceholders[tab]}</div>
  )
}
