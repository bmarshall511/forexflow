"use client"

import { useState } from "react"
import Link from "next/link"
import { Target, Zap, Scale, Trophy, Flame, type LucideIcon } from "lucide-react"
import type { PerformanceSummary } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { DeltaBadge, MetricDrawer, MetricTile } from "@/components/dashboard/shared"

/**
 * KPI tile grid for the performance hero. Each tile is a drill target —
 * tapping opens a drawer with the metric's definition + formula +
 * deep-link to the full analytics page. Keeps the hero container small
 * and the drawer wiring out of the data-fetching layer.
 */
type MetricKey = "winRate" | "profitFactor" | "expectancy" | "avgRR" | "streak"

interface KpiGridProps {
  summary: PerformanceSummary | null
  currency: string
}

interface Definition {
  title: string
  icon: LucideIcon
  definition: string
  formula?: string
  analyticsHref: string
}

const DEFS: Record<MetricKey, Definition> = {
  winRate: {
    title: "Win rate",
    icon: Target,
    definition:
      "Share of closed trades that ended in profit. Useful for gauging strategy consistency — a 50% win rate can still be profitable if your winners are bigger than your losers.",
    formula: "wins ÷ (wins + losses)",
    analyticsHref: "/analytics",
  },
  profitFactor: {
    title: "Profit factor",
    icon: Zap,
    definition:
      "Ratio of gross profit to gross loss. Anything above 1.0 means you're net-positive; 1.5+ is generally considered a healthy edge.",
    formula: "Σ winning P&L ÷ |Σ losing P&L|",
    analyticsHref: "/analytics",
  },
  expectancy: {
    title: "Expectancy",
    icon: Scale,
    definition:
      "Average expected P&L per trade, based on win rate and the size of your wins/losses. Multiply by trade count to estimate total.",
    formula: "winRate × avgWin − lossRate × avgLoss",
    analyticsHref: "/analytics",
  },
  avgRR: {
    title: "Average risk-reward",
    icon: Target,
    definition:
      "Average reward-to-risk ratio from the stop-loss and take-profit levels set on entry. Higher values mean you're giving trades more room to pay off relative to the risk.",
    formula: "avg(|TP − entry| ÷ |entry − SL|)",
    analyticsHref: "/analytics",
  },
  streak: {
    title: "Current streak",
    icon: Trophy,
    definition:
      "Consecutive winning or losing trades at the most recent close. Streaks of 3+ are worth paying attention to — they often reveal a regime change or a working pattern.",
    formula: "walk back from latest trade while outcome matches",
    analyticsHref: "/analytics",
  },
}

export function PerformanceHeroKpis({ summary, currency }: KpiGridProps) {
  const [active, setActive] = useState<MetricKey | null>(null)

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
  const activeDef = active ? DEFS[active] : null

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricTile
          icon={<Target className="size-3.5" />}
          label="Win rate"
          tone={winRatePct >= 50 ? "positive" : "negative"}
          value={summary.totalTrades > 0 ? `${winRatePct}%` : "—"}
          subtitle={
            summary.totalTrades > 0 ? `${summary.wins}W · ${summary.losses}L` : "No trades yet"
          }
          onDrill={() => setActive("winRate")}
          drillAriaLabel="Open win rate details"
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
          onDrill={() => setActive("profitFactor")}
          drillAriaLabel="Open profit factor details"
        />
        <MetricTile
          icon={<Scale className="size-3.5" />}
          label="Expectancy"
          tone={
            summary.expectancy > 0 ? "positive" : summary.expectancy < 0 ? "negative" : "neutral"
          }
          private
          value={formatCurrency(summary.expectancy, currency)}
          subtitle="Per-trade EV"
          onDrill={() => setActive("expectancy")}
          drillAriaLabel="Open expectancy details"
        />
        <MetricTile
          icon={<Target className="size-3.5" />}
          label="Avg R:R"
          value={summary.avgRR > 0 ? `${summary.avgRR.toFixed(2)}:1` : "—"}
          subtitle="From SL/TP"
          onDrill={() => setActive("avgRR")}
          drillAriaLabel="Open average risk-reward details"
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
          onDrill={() => setActive("streak")}
          drillAriaLabel="Open streak details"
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

      {activeDef && (
        <MetricDrawer
          open={active !== null}
          onOpenChange={(open) => !open && setActive(null)}
          icon={activeDef.icon}
          title={activeDef.title}
          definition={activeDef.definition}
          formula={activeDef.formula}
          analyticsHref={activeDef.analyticsHref}
        />
      )}
    </>
  )
}
