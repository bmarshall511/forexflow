"use client"

import { GreetingBar } from "./greeting-bar"
import { HeroMetrics } from "./hero-metrics"
import { TradeSpotlight } from "./trade-spotlight"
import { ActivityFeed } from "./activity-feed"
import { AutomationBar } from "./automation-bar"
import { MarketCalendarCard } from "./market-calendar-card"
import { PerformanceCard } from "./performance-card"
import { SourcePerformanceCard } from "./source-performance-card"
import { AiInsightsBar } from "./ai-insights-bar"
import { CardErrorBoundary } from "@/components/ui/card-error-boundary"

/**
 * Dashboard layout — narrative-driven trading cockpit.
 *
 * Section order (top-to-bottom priority):
 * 1. Greeting — time/market-aware context
 * 2. Hero Metrics — 5 key numbers at a glance
 * 3. Live Trades + Activity — what's happening right now
 * 4. Automation — system status strip
 * 5. Market + Performance — calendar and equity curve
 * 6. AI Insights — costs and analysis summary
 */
export function DashboardContent() {
  return (
    <div className="space-y-4 pb-8">
      {/* ── Section 1: Greeting ─────────────────────────────────────────── */}
      <CardErrorBoundary>
        <GreetingBar />
      </CardErrorBoundary>

      {/* ── Section 2: Hero Metrics ─────────────────────────────────────── */}
      <CardErrorBoundary>
        <HeroMetrics />
      </CardErrorBoundary>

      {/* ── Section 3: Live Trades + Activity Feed ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 px-4 md:px-6 xl:grid-cols-2 xl:items-start">
        <CardErrorBoundary>
          <TradeSpotlight />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <ActivityFeed />
        </CardErrorBoundary>
      </div>

      {/* ── Section 4: Automation Status ────────────────────────────────── */}
      <div className="px-4 md:px-6">
        <CardErrorBoundary>
          <AutomationBar />
        </CardErrorBoundary>
      </div>

      {/* ── Section 5: Source Performance Breakdown ─────────────────────── */}
      <div className="px-4 md:px-6">
        <CardErrorBoundary>
          <SourcePerformanceCard />
        </CardErrorBoundary>
      </div>

      {/* ── Section 6: Market Calendar + Performance ────────────────────── */}
      <div className="grid grid-cols-1 gap-4 px-4 md:px-6 xl:grid-cols-2 xl:items-start">
        <CardErrorBoundary>
          <MarketCalendarCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <PerformanceCard />
        </CardErrorBoundary>
      </div>

      {/* ── Section 6: AI Insights ──────────────────────────────────────── */}
      <div className="px-4 md:px-6">
        <CardErrorBoundary>
          <AiInsightsBar />
        </CardErrorBoundary>
      </div>
    </div>
  )
}
