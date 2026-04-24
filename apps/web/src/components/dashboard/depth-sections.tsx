"use client"

import { useMemo, useState } from "react"
import { ChevronDown, BarChart3, CalendarDays, Clock, Coins, Workflow } from "lucide-react"
import type { DashboardAnalyticsPayload } from "@/app/api/analytics/dashboard/route"
import type { HourOfDayPerformance, MfeMaeEntry } from "@fxflow/types"
import { useDashboardPeriod } from "@/hooks/use-dashboard-period"
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CalendarHeatmap,
  InstrumentBars,
  MfeMaeScatter,
  SessionClock,
  SourceWaterfall,
} from "@/components/dashboard/shared"
import { cn } from "@/lib/utils"

/**
 * Phase 3 depth-visuals container.
 *
 * Pulls from the same /api/analytics/dashboard aggregator used by the hero
 * for calendar + instruments + source waterfall. Session clock needs
 * hour-of-day which lives on /api/analytics/by-time, and MFE/MAE is on
 * /api/analytics/edge — each is a separate fetch with its own invalidate key.
 *
 * Visuals grouped into three rows matching the design spec:
 *   When   — calendar heatmap + session clock
 *   Where  — top instruments
 *   Why    — source waterfall attribution
 *   Edge   — MFE/MAE (collapsible, off by default)
 */
function buildAggregatorUrl(dateFrom: Date, dateTo: Date | undefined) {
  const params = new URLSearchParams({ dateFrom: dateFrom.toISOString() })
  if (dateTo) params.set("dateTo", dateTo.toISOString())
  return `/api/analytics/dashboard?${params.toString()}`
}

function buildByTimeUrl(dateFrom: Date, dateTo: Date | undefined) {
  const params = new URLSearchParams({ dateFrom: dateFrom.toISOString() })
  if (dateTo) params.set("dateTo", dateTo.toISOString())
  return `/api/analytics/by-time?${params.toString()}`
}

function buildEdgeUrl(dateFrom: Date, dateTo: Date | undefined) {
  const params = new URLSearchParams({ dateFrom: dateFrom.toISOString() })
  if (dateTo) params.set("dateTo", dateTo.toISOString())
  return `/api/analytics/edge?${params.toString()}`
}

type SourcePeriod = "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime"

export function DepthSections() {
  const { period, range, rolloverKey } = useDashboardPeriod()
  const { accountOverview } = useDaemonStatus()
  const currency = accountOverview?.summary.currency ?? "USD"
  const invalidateKey = `${period}:${rolloverKey}`

  const aggregatorUrl = useMemo(
    () => buildAggregatorUrl(range.dateFrom, range.dateTo),
    [range.dateFrom, range.dateTo],
  )
  const byTimeUrl = useMemo(
    () => buildByTimeUrl(range.dateFrom, range.dateTo),
    [range.dateFrom, range.dateTo],
  )
  const edgeUrl = useMemo(
    () => buildEdgeUrl(range.dateFrom, range.dateTo),
    [range.dateFrom, range.dateTo],
  )

  const {
    data: agg,
    isLoading: aggLoading,
    error: aggError,
  } = useDashboardAnalytics<DashboardAnalyticsPayload>(aggregatorUrl, {
    invalidateOn: ["positions_update", "account_overview_update"],
    invalidateKey,
  })
  const { data: byTime, isLoading: byTimeLoading } = useDashboardAnalytics<{
    byDayOfWeek: unknown[]
    byHourOfDay: HourOfDayPerformance[]
  }>(byTimeUrl, {
    invalidateOn: ["positions_update"],
    invalidateKey,
  })
  const [edgeOpen, setEdgeOpen] = useState(false)
  const { data: edge, isLoading: edgeLoading } = useDashboardAnalytics<MfeMaeEntry[]>(edgeUrl, {
    invalidateOn: ["positions_update"],
    invalidateKey,
    enabled: edgeOpen,
  })

  const sourcePeriod = useMemo<SourcePeriod>(() => {
    switch (period) {
      case "today":
        return "today"
      case "thisWeek":
        return "thisWeek"
      case "thisMonth":
        return "thisMonth"
      case "thisYear":
        return "thisYear"
      case "allTime":
        return "allTime"
    }
  }, [period])

  // If the aggregator errored surface it once at the top rather than
  // showing a flashing skeleton inside every sub-card.
  if (aggError && !agg) {
    return (
      <div className="bg-card border-status-disconnected/30 space-y-2 rounded-xl border p-4 text-center">
        <h2 className="text-sm font-medium">Couldn&apos;t load analytics</h2>
        <p className="text-muted-foreground mx-auto max-w-md text-xs">
          {aggError.message ||
            "The /api/analytics/dashboard endpoint returned an error. Check the daemon is reachable and that the current account has data."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* When — calendar + session clock */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard icon={<CalendarDays className="size-4" />} title="Daily P&L">
          {aggLoading && !agg ? (
            <Skeleton className="h-[120px] w-full rounded-lg" />
          ) : (
            <CalendarHeatmap equity={agg?.equity ?? []} weeks={26} currency={currency} />
          )}
        </SectionCard>

        <SectionCard icon={<Clock className="size-4" />} title="Best hours">
          {byTimeLoading && !byTime ? (
            <Skeleton className="mx-auto h-[200px] w-[200px] rounded-full" />
          ) : (
            <SessionClock
              data={byTime?.byHourOfDay ?? []}
              currency={currency}
              size={200}
              className="mx-auto"
            />
          )}
        </SectionCard>
      </div>

      {/* Where — instrument contribution */}
      <SectionCard icon={<Coins className="size-4" />} title="Top instruments">
        {aggLoading && !agg ? (
          <Skeleton className="h-[180px] w-full rounded-lg" />
        ) : (
          <InstrumentBars data={agg?.byInstrument ?? []} top={8} currency={currency} />
        )}
      </SectionCard>

      {/* Why — source attribution */}
      <SectionCard icon={<Workflow className="size-4" />} title="What drove it?">
        {aggLoading && !agg ? (
          <Skeleton className="h-[120px] w-full rounded-lg" />
        ) : (
          <SourceWaterfall data={agg?.source ?? []} period={sourcePeriod} currency={currency} />
        )}
      </SectionCard>

      {/* Edge — MFE/MAE, collapsible */}
      <section className="bg-card border-border/50 rounded-xl border">
        <button
          type="button"
          onClick={() => setEdgeOpen((v) => !v)}
          aria-expanded={edgeOpen}
          aria-controls="edge-panel"
          className={cn(
            "flex w-full items-center gap-2 px-4 py-3 text-left",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
          )}
        >
          <BarChart3 className="text-muted-foreground size-4" aria-hidden="true" />
          <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Edge — how much did you leave on the table?
          </h2>
          <span className="flex-1" />
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              edgeOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {edgeOpen && (
          <div id="edge-panel" className="border-t px-4 py-3">
            {edgeLoading && !edge ? (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            ) : (
              <MfeMaeScatter data={edge ?? []} height={260} />
            )}
            <p className="text-muted-foreground/70 mt-2 text-[10px]">
              Top-right = ran deep in your favor AND deep against you before closing. Left-lean wins
              = caught them early.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-card border-border/50 space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}
