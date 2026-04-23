"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { TrendingUp, Target, Zap, Scale, Trophy, Flame } from "lucide-react"
import type { DashboardAnalyticsPayload } from "@/app/api/analytics/dashboard/route"
import { formatCurrency, formatPnL } from "@fxflow/shared"
import { useDashboardPeriod } from "@/hooks/use-dashboard-period"
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Skeleton } from "@/components/ui/skeleton"
import { MetricTile, DeltaBadge } from "@/components/dashboard/shared"
import { PerformanceHeroChart } from "./performance-hero-chart"
import { cn } from "@/lib/utils"

/**
 * Performance Hero — the centerpiece of the redesigned dashboard.
 *
 * Renders a balance/cumulative-P&L curve with a drawdown band, plus a grid
 * of 5 KPI tiles (Win Rate, Profit Factor, Expectancy, Avg R:R, Streak)
 * scoped to the current dashboard period + account. All data comes from
 * the single aggregator endpoint so first paint is one round trip.
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

export function PerformanceHero() {
  const { period, range, rolloverKey } = useDashboardPeriod()
  const { accountOverview } = useDaemonStatus()
  const [variant, setVariant] = useState<Variant>("balance")

  const currency = accountOverview?.summary.currency ?? "USD"
  const nav = accountOverview?.summary.nav ?? null
  // Balance curve needs a starting anchor — use (current balance − cumulative
  // P&L so far) so the curve lines up with the live balance at the end.
  // Omit when nav is null; the hero falls back to cumulative-P&L-only.
  const startingBalanceGuess = useMemo(() => {
    if (nav == null) return null
    // We don't have deposits/withdrawals history here; best effort is to
    // anchor at NAV so the curve ends at the user's current balance.
    // Server computes balance[i] = starting + cumulativePL[i], so
    // starting = nav - cumulativePL[last]. We'll let the server echo that
    // back — pass nav and let the chart align visually.
    return nav
  }, [nav])

  const url = useMemo(
    () => buildUrl(range.dateFrom, range.dateTo, startingBalanceGuess),
    [range.dateFrom, range.dateTo, startingBalanceGuess],
  )

  const { data, isLoading, isRefreshing } = useDashboardAnalytics<DashboardAnalyticsPayload>(url, {
    // `positions_update` fires on any open/close/fill transition;
    // account_overview_update carries the authoritative P&L numbers; the
    // AI-trader / smart-flow trade events cover closes from those pipelines.
    invalidateOn: [
      "positions_update",
      "account_overview_update",
      "ai_trader_trade_closed",
      "smart_flow_trade_update",
    ],
    invalidateKey: `${period}:${rolloverKey}`,
  })

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

      <KpiGrid summary={data?.summary ?? null} currency={currency} />
    </section>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function HeroHeader({
  data,
  currency,
  variant,
  onVariantChange,
  isRefreshing,
}: {
  data: DashboardAnalyticsPayload | null
  currency: string
  variant: Variant
  onVariantChange: (v: Variant) => void
  isRefreshing: boolean
}) {
  const total = data?.summary?.totalPL ?? 0
  const pnl = formatPnL(total, currency)
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <TrendingUp className="size-3.5" aria-hidden="true" />
          Performance
          {isRefreshing && <span className="text-muted-foreground/60">· refreshing…</span>}
        </h2>
        <p
          className={cn(
            "mt-1 font-mono text-2xl font-bold tabular-nums",
            pnl.colorIntent === "positive" && "text-status-connected",
            pnl.colorIntent === "negative" && "text-status-disconnected",
          )}
          data-private="true"
        >
          <AnimatedNumber value={pnl.formatted} />
        </p>
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

function KpiGrid({
  summary,
  currency,
}: {
  summary: DashboardAnalyticsPayload["summary"] | null
  currency: string
}) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[70px] rounded-xl" />
        ))}
      </div>
    )
  }

  const winRatePct = Math.round(summary.winRate * 100)
  const pf = summary.profitFactor >= 999 ? "∞" : summary.profitFactor.toFixed(2)
  const streakTone = summary.currentStreak.type === "win" ? "positive" : "negative"
  const StreakIcon = summary.currentStreak.type === "win" ? Trophy : Flame

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <MetricTile
        icon={<Target className="size-3.5" />}
        label="Win rate"
        tone={winRatePct >= 50 ? "positive" : "negative"}
        value={summary.totalTrades > 0 ? `${winRatePct}%` : "—"}
        subtitle={
          summary.totalTrades > 0 ? `${summary.wins}W · ${summary.losses}L` : "No trades yet"
        }
      />
      <MetricTile
        icon={<Zap className="size-3.5" />}
        label="Profit factor"
        tone={
          summary.profitFactor >= 1.5
            ? "positive"
            : summary.profitFactor >= 1
              ? "neutral"
              : "negative"
        }
        value={pf}
        subtitle="Gross win ÷ gross loss"
      />
      <MetricTile
        icon={<Scale className="size-3.5" />}
        label="Expectancy"
        tone={summary.expectancy > 0 ? "positive" : summary.expectancy < 0 ? "negative" : "neutral"}
        private
        value={formatCurrency(summary.expectancy, currency)}
        subtitle="Per-trade EV"
      />
      <MetricTile
        icon={<Target className="size-3.5" />}
        label="Avg R:R"
        value={summary.avgRR > 0 ? `${summary.avgRR.toFixed(2)}:1` : "—"}
        subtitle="From SL/TP"
      />
      <MetricTile
        icon={<StreakIcon className="size-3.5" />}
        label="Streak"
        tone={summary.currentStreak.count < 2 ? "neutral" : streakTone}
        value={
          summary.currentStreak.count >= 2
            ? `${summary.currentStreak.count}${summary.currentStreak.type === "win" ? "W" : "L"}`
            : "—"
        }
        footer={
          summary.longestWinStreak >= 3 ? (
            <DeltaBadge
              value={summary.longestWinStreak}
              variant="absolute"
              label={`peak ${summary.longestWinStreak}W`}
              tone="neutral"
            />
          ) : null
        }
      />
      <div className="col-span-2 hidden lg:flex">
        <Link
          href="/analytics"
          className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 self-center text-xs transition-colors"
        >
          View full analytics →
        </Link>
      </div>
    </div>
  )
}
