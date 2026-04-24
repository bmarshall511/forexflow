"use client"

import { useMemo, useState } from "react"
import { TrendingUp } from "lucide-react"
import type { DashboardAnalyticsPayload } from "@/app/api/analytics/dashboard/route"
import type { PerformanceSummary } from "@fxflow/types"
import { formatCurrency, formatPnL } from "@fxflow/shared"
import { useDashboardPeriod } from "@/hooks/use-dashboard-period"
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Skeleton } from "@/components/ui/skeleton"
import { DeltaBadge, comparePeriods, vsPriorLabel } from "@/components/dashboard/shared"
import { PerformanceHeroChart } from "./performance-hero-chart"
import { PerformanceHeroKpis } from "./performance-hero-kpis"
import { cn } from "@/lib/utils"

/**
 * Performance Hero — the centerpiece of the redesigned dashboard.
 *
 * Renders a balance/cumulative-P&L curve with a drawdown band, plus a grid
 * of 5 KPI tiles (in PerformanceHeroKpis). All data comes from the single
 * aggregator endpoint so first paint is one round trip. A second fetch —
 * the same endpoint shifted one window earlier — powers the "vs previous"
 * comparison pill.
 */
const VARIANTS = [
  { value: "balance", label: "Balance" },
  { value: "cumulative", label: "Cumulative P&L" },
] as const

type Variant = (typeof VARIANTS)[number]["value"]

function buildUrl(dateFrom: Date, dateTo: Date | undefined, startingBalance: number | null) {
  const params = new URLSearchParams({ dateFrom: dateFrom.toISOString() })
  if (dateTo) params.set("dateTo", dateTo.toISOString())
  if (startingBalance != null) params.set("startingBalance", String(startingBalance))
  return `/api/analytics/dashboard?${params.toString()}`
}

/**
 * Shift a range one window earlier so we can fetch the prior period and
 * show a "+8% vs last month" style comparison. Size of the window is
 * (dateTo ?? now) − dateFrom.
 */
function priorWindow(dateFrom: Date, dateTo: Date | undefined): { from: Date; to: Date } {
  const end = dateTo ?? new Date()
  const windowMs = end.getTime() - dateFrom.getTime()
  return {
    from: new Date(dateFrom.getTime() - windowMs),
    to: new Date(dateFrom.getTime()),
  }
}

export function PerformanceHero() {
  const { period, range, rolloverKey } = useDashboardPeriod()
  const { accountOverview } = useDaemonStatus()
  const [variant, setVariant] = useState<Variant>("balance")

  const currency = accountOverview?.summary.currency ?? "USD"
  const nav = accountOverview?.summary.nav ?? null
  const startingBalanceGuess = nav

  const url = useMemo(
    () => buildUrl(range.dateFrom, range.dateTo, startingBalanceGuess),
    [range.dateFrom, range.dateTo, startingBalanceGuess],
  )

  // Prior-period url. Skip for allTime (no "prior" exists).
  const priorUrl = useMemo(() => {
    if (period === "allTime") return null
    const prior = priorWindow(range.dateFrom, range.dateTo)
    return buildUrl(prior.from, prior.to, null)
  }, [period, range.dateFrom, range.dateTo])

  const invalidateKey = `${period}:${rolloverKey}`

  const { data, isLoading, isRefreshing } = useDashboardAnalytics<DashboardAnalyticsPayload>(url, {
    invalidateOn: [
      "positions_update",
      "account_overview_update",
      "ai_trader_trade_closed",
      "smart_flow_trade_update",
    ],
    invalidateKey,
  })

  const { data: priorData } = useDashboardAnalytics<DashboardAnalyticsPayload>(
    priorUrl ?? "/api/analytics/dashboard?skip=1",
    {
      invalidateOn: ["positions_update", "account_overview_update"],
      invalidateKey,
      enabled: priorUrl !== null,
    },
  )

  return (
    <section
      className={cn(
        "bg-card border-border/50 space-y-4 rounded-xl border p-4",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
      )}
      aria-label="Performance overview"
    >
      <HeroHeader
        data={data}
        priorSummary={priorData?.summary ?? null}
        period={period}
        currency={currency}
        variant={variant}
        onVariantChange={setVariant}
        isRefreshing={isRefreshing}
      />

      {isLoading && !data ? (
        <Skeleton className="h-[220px] w-full rounded-lg" />
      ) : data && data.equity.length > 0 ? (
        <PerformanceHeroChart
          equity={data.equity}
          drawdown={data.drawdown}
          variant={variant}
          currency={currency}
          liveBalance={nav}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <TrendingUp className="text-muted-foreground size-8" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">No closed trades in this period</p>
        </div>
      )}

      <PerformanceHeroKpis summary={data?.summary ?? null} currency={currency} />
    </section>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function HeroHeader({
  data,
  priorSummary,
  period,
  currency,
  variant,
  onVariantChange,
  isRefreshing,
}: {
  data: DashboardAnalyticsPayload | null
  priorSummary: PerformanceSummary | null
  period: "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime"
  currency: string
  variant: Variant
  onVariantChange: (v: Variant) => void
  isRefreshing: boolean
}) {
  const total = data?.summary?.totalPL ?? 0
  const pnl = formatPnL(total, currency)
  const delta =
    data?.summary && priorSummary
      ? comparePeriods({ current: total, prior: priorSummary.totalPL })
      : null
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <TrendingUp className="size-3.5" aria-hidden="true" />
          Performance
          {isRefreshing && <span className="text-muted-foreground/60">· refreshing…</span>}
        </h2>
        <div className="mt-1 flex items-baseline gap-2">
          <p
            className={cn(
              "font-mono text-2xl font-bold tabular-nums",
              pnl.colorIntent === "positive" && "text-status-connected",
              pnl.colorIntent === "negative" && "text-status-disconnected",
            )}
            data-private="true"
          >
            <AnimatedNumber value={pnl.formatted} />
          </p>
          {delta && delta.pct !== null && (
            <DeltaBadge value={delta.pct} variant="percent" label={vsPriorLabel(period)} />
          )}
        </div>
        {data?.summary && data.summary.totalTrades > 0 && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {data.summary.totalTrades} trade{data.summary.totalTrades !== 1 ? "s" : ""} ·{" "}
            <span data-private="true">
              avg {formatCurrency(data.summary.avgPL, currency)}/trade
            </span>
          </p>
        )}
      </div>
      <div
        className="bg-muted/60 inline-flex rounded-full p-0.5"
        role="radiogroup"
        aria-label="Chart series"
      >
        {VARIANTS.map((v) => (
          <button
            key={v.value}
            role="radio"
            aria-checked={variant === v.value}
            onClick={() => onVariantChange(v.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
              "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
              variant === v.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
