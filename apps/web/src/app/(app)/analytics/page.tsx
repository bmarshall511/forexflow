"use client"

import { useState, useEffect } from "react"
import type { AnalyticsFilters } from "@fxflow/types"
import { BarChart3, PieChart, Clock, Layers, Target, TrendingUp } from "lucide-react"
import { useUrlState } from "@/hooks/use-url-state"
import { useAnalytics } from "@/hooks/use-analytics"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsFilterBar } from "@/components/analytics/analytics-filters"
import { AnalyticsSummaryBar } from "@/components/analytics/analytics-summary-bar"
import { EquityCurveChart } from "@/components/analytics/equity-curve-chart"
import { InstrumentTable } from "@/components/analytics/instrument-table"
import { SessionChart } from "@/components/analytics/session-chart"
import { TimeHeatmap } from "@/components/analytics/time-heatmap"
import { SourceBreakdown } from "@/components/analytics/source-breakdown"
import { EdgeAnalysis } from "@/components/analytics/edge-analysis"
import { PageHeader } from "@/components/ui/page-header"

const TABS = [
  { id: "overview", label: "Overview", icon: <TrendingUp className="size-4" /> },
  { id: "instrument", label: "Currency Pairs", icon: <BarChart3 className="size-4" /> },
  { id: "session", label: "Sessions", icon: <PieChart className="size-4" /> },
  { id: "time", label: "Time of Day", icon: <Clock className="size-4" /> },
  { id: "source", label: "Sources", icon: <Layers className="size-4" /> },
  { id: "edge", label: "Trade Quality", icon: <Target className="size-4" /> },
] as const

export default function AnalyticsPage() {
  const [tab, setTab] = useUrlState("tab", "overview")
  const [filters, setFilters] = useState<AnalyticsFilters>({})
  const analytics = useAnalytics(filters)

  useEffect(() => {
    if (tab !== "overview") analytics.fetchTab(tab)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        title="How Am I Doing?"
        subtitle="A clear breakdown of your trading results -- what is working and what is not"
        icon={TrendingUp}
      >
        <AnalyticsFilterBar filters={filters} onChange={setFilters} />
      </PageHeader>

      {/* Summary tiles */}
      <div className="px-4 pb-4 md:px-6">
        {analytics.isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : analytics.summary ? (
          <AnalyticsSummaryBar summary={analytics.summary} />
        ) : null}
      </div>

      {/* Tab nav */}
      <TabNav label="Analytics sections">
        {TABS.map((t) => (
          <TabNavButton
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            icon={t.icon}
            label={t.label}
            count={0}
          />
        ))}
      </TabNav>

      {/* Tab content */}
      <div className="p-4 md:p-6">
        {tab === "overview" && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Your Account Balance Over Time</h2>
            <p className="text-muted-foreground text-xs">
              Green means your balance was going up, red means it was going down
            </p>
            {analytics.isLoading ? (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            ) : (
              <EquityCurveChart data={analytics.equityCurve} />
            )}
          </div>
        )}
        {tab === "instrument" &&
          (analytics.isTabLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <InstrumentTable data={analytics.byInstrument} />
          ))}
        {tab === "session" &&
          (analytics.isTabLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <SessionChart data={analytics.bySession} />
          ))}
        {tab === "time" &&
          (analytics.isTabLoading || !analytics.byTime ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <TimeHeatmap
              byDayOfWeek={analytics.byTime.byDayOfWeek}
              byHourOfDay={analytics.byTime.byHourOfDay}
            />
          ))}
        {tab === "source" &&
          (analytics.isTabLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <SourceBreakdown data={analytics.bySource} />
          ))}
        {tab === "edge" &&
          (analytics.isTabLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <EdgeAnalysis data={analytics.edge} />
          ))}
      </div>
    </div>
  )
}
