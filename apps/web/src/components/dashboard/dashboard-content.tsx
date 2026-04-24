"use client"

import { DashboardHeader } from "./dashboard-header"
import { GreetingBar } from "./greeting-bar"
import { LiveStrip } from "./live-strip"
import { PerformanceHero } from "./performance-hero"
import { DepthSections } from "./depth-sections"
import { TradeSpotlight } from "./trade-spotlight"
import { ActivityFeed } from "./activity-feed"
import { AutomationBar } from "./automation-bar"
import { MarketCalendarCard } from "./market-calendar-card"
import { SetupPanel } from "@/components/dashboard/shared"
import { CardErrorBoundary } from "@/components/ui/card-error-boundary"

/**
 * Dashboard layout — redesigned.
 *
 * Section order:
 *   0. Sticky header — active-account pill, period picker, privacy, conn health
 *   1. Setup Needed panel (auto-hides when clean)
 *   2. Greeting — time / market-aware context
 *   3. Live strip — WS-driven Balance / Day Change / Open P&L / Margin / Active
 *   4. Performance hero — balance/cumulative curve + drawdown + 5 KPI tiles
 *      (each tile is a drill target)
 *   5. Depth sections — calendar heatmap · session clock · instrument bars ·
 *      source waterfall · collapsible MFE/MAE
 *   6. Live trades + Activity feed (two columns on xl)
 *   7. Automation status strip
 *   8. Market calendar rail
 *
 * The prior layout mixed redesigned and legacy cards; that made the visual
 * hierarchy muddy. The legacy SmartFlowCard is gone (its data lives in the
 * AutomationBar strip + SourceWaterfall). The legacy AiInsightsBar is gone
 * (token costs live on the Settings → AI page). HeroMetrics and
 * PerformanceCard were replaced by LiveStrip + PerformanceHero in Phase 2,
 * SourcePerformanceCard by SourceWaterfall in Phase 3.
 */
export function DashboardContent() {
  return (
    <div className="pb-8">
      <CardErrorBoundary>
        <DashboardHeader />
      </CardErrorBoundary>

      <div className="space-y-4 pt-3">
        <div className="px-4 md:px-6">
          <CardErrorBoundary>
            <SetupPanel />
          </CardErrorBoundary>
        </div>

        <CardErrorBoundary>
          <GreetingBar />
        </CardErrorBoundary>

        <CardErrorBoundary>
          <LiveStrip />
        </CardErrorBoundary>

        <div className="px-4 md:px-6">
          <CardErrorBoundary>
            <PerformanceHero />
          </CardErrorBoundary>
        </div>

        <div className="px-4 md:px-6">
          <CardErrorBoundary>
            <DepthSections />
          </CardErrorBoundary>
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 md:px-6 xl:grid-cols-2 xl:items-start">
          <CardErrorBoundary>
            <TradeSpotlight />
          </CardErrorBoundary>
          <CardErrorBoundary>
            <ActivityFeed />
          </CardErrorBoundary>
        </div>

        <div className="px-4 md:px-6">
          <CardErrorBoundary>
            <AutomationBar />
          </CardErrorBoundary>
        </div>

        <div className="px-4 md:px-6">
          <CardErrorBoundary>
            <MarketCalendarCard />
          </CardErrorBoundary>
        </div>
      </div>
    </div>
  )
}
