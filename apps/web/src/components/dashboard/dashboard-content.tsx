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
import { AiInsightsBar } from "./ai-insights-bar"
import { SmartFlowCard } from "./smart-flow-card"
import { SetupPanel } from "@/components/dashboard/shared"
import { CardErrorBoundary } from "@/components/ui/card-error-boundary"

/**
 * Dashboard layout — redesigned (Phase 2 core).
 *
 * Section order:
 *   0. Sticky header — active-account pill, period picker, privacy, conn health
 *   1. Setup Needed panel (auto-hides when clean)
 *   2. Greeting — time/market-aware context
 *   3. Live strip — WS-driven Balance / Day Change / Open P&L / Margin / Active
 *   4. Performance hero — balance/cumulative curve + drawdown + 5 KPI tiles
 *   5. Live trades + Activity feed (two columns on xl)
 *   6. Automation status strip
 *   7. SmartFlow card
 *   8. Source performance breakdown (per-period)
 *   9. Market calendar (+ AI Insights bar)
 *
 * Legacy PerformanceCard + HeroMetrics are removed — PerformanceHero and
 * LiveStrip cover their purpose with richer data (now period + account
 * scoped end-to-end).
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
            <SmartFlowCard />
          </CardErrorBoundary>
        </div>

        <div className="px-4 md:px-6">
          <CardErrorBoundary>
            <MarketCalendarCard />
          </CardErrorBoundary>
        </div>

        <div className="px-4 md:px-6">
          <CardErrorBoundary>
            <AiInsightsBar />
          </CardErrorBoundary>
        </div>
      </div>
    </div>
  )
}
