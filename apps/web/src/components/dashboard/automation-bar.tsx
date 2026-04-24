"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { useDashboardPeriod } from "@/hooks/use-dashboard-period"
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics"
import type { DashboardAnalyticsPayload } from "@/app/api/analytics/dashboard/route"
import { formatPnL } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Radio, Search, Bot, Settings, MousePointer, Workflow } from "lucide-react"
import type { TradeSource } from "@fxflow/types"

// ─── Source stats helper ────────────────────────────────────────────────────

interface SourceStats {
  openCount: number
  unrealizedPL: number
  /** Closed-trade count for the currently-selected dashboard period. */
  closedCount: number
  /** Closed-trade P&L for the currently-selected dashboard period. */
  closedPL: number
  wins: number
  losses: number
}

const EMPTY_STATS: SourceStats = {
  openCount: 0,
  unrealizedPL: 0,
  closedCount: 0,
  closedPL: 0,
  wins: 0,
  losses: 0,
}

type SourcePeriodKey = "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime"

/**
 * Live open-trade stats (WS-driven) merged with period-scoped closed-trade
 * stats from the analytics aggregator. Replaces the old today-only logic
 * so every module reads the same period as the rest of the dashboard.
 */
function useSourceStats() {
  const { openWithPrices } = usePositions()
  const { period, range, rolloverKey } = useDashboardPeriod()

  const fromMs = range.dateFrom.getTime()
  const toMs = range.dateTo?.getTime() ?? null
  const url = useMemo(() => {
    const params = new URLSearchParams({ dateFrom: range.dateFrom.toISOString() })
    if (range.dateTo) params.set("dateTo", range.dateTo.toISOString())
    return `/api/analytics/dashboard?${params.toString()}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromMs, toMs])

  const { data } = useDashboardAnalytics<DashboardAnalyticsPayload>(url, {
    invalidateOn: ["positions_update", "account_overview_update"],
    invalidateKey: `${period}:${rolloverKey}`,
  })

  return useMemo(() => {
    const map = new Map<TradeSource, SourceStats>()
    const get = (s: TradeSource) => {
      let v = map.get(s)
      if (!v) {
        v = { ...EMPTY_STATS }
        map.set(s, v)
      }
      return v
    }

    // Live open trades — always "right now", never period-scoped.
    for (const t of openWithPrices) {
      const s = get(t.source)
      s.openCount++
      s.unrealizedPL += t.unrealizedPL
    }

    // Closed-trade stats pulled from the aggregator source breakdown for the
    // active period. Each source row exposes per-period stats so there's
    // no extra round trip.
    const periodKey: SourcePeriodKey = period
    for (const source of data?.source ?? []) {
      const stats = source[periodKey]
      if (!stats || stats.trades === 0) continue
      const s = get(source.source as TradeSource)
      s.closedCount += stats.trades
      s.closedPL += stats.totalPL
      s.wins += stats.wins
      s.losses += stats.losses
    }

    return map
  }, [openWithPrices, data, period])
}

// ─── Status dot ──────────────────────────────────────────────────────────────

type Status = "active" | "scanning" | "idle" | "disabled" | "error"

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "active" && "bg-status-connected",
        status === "scanning" && "bg-status-warning animate-pulse",
        status === "idle" && "bg-status-connecting",
        status === "disabled" && "bg-muted-foreground/40",
        status === "error" && "bg-status-disconnected",
      )}
    />
  )
}

// ─── Module segment ──────────────────────────────────────────────────────────

interface ModuleSegmentProps {
  icon: React.ElementType
  name: string
  status: Status
  line1: string
  stats?: SourceStats | null
  currency?: string
  href: string
  settingsHref?: string
}

function ModuleSegment({
  icon: Icon,
  name,
  status,
  line1,
  stats,
  currency = "USD",
  href,
  settingsHref,
}: ModuleSegmentProps) {
  const hasOpenTrades = stats && stats.openCount > 0
  const hasClosedPeriod = stats && stats.closedCount > 0

  return (
    <div className="border-border/50 flex flex-1 flex-col gap-1.5 border-r p-3 last:border-r-0">
      <div className="flex items-center justify-between">
        <Link
          href={href}
          className="hover:text-foreground flex items-center gap-2 text-xs font-semibold transition-colors"
        >
          <Icon className="text-muted-foreground size-3.5" />
          <StatusDot status={status} />
          <span>{name}</span>
        </Link>
        {settingsHref && (
          <Link
            href={settingsHref}
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            aria-label={`${name} settings`}
          >
            <Settings className="size-3" />
          </Link>
        )}
      </div>
      <span className="text-muted-foreground truncate text-[10px]">{line1}</span>
      {(hasOpenTrades || hasClosedPeriod) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {hasOpenTrades && (
            <span className="text-[10px] tabular-nums" data-private="true">
              <span className="text-muted-foreground">{stats.openCount} open</span>{" "}
              <span
                className={cn(
                  "font-medium",
                  stats.unrealizedPL >= 0 ? "text-status-connected" : "text-status-disconnected",
                )}
              >
                {formatPnL(stats.unrealizedPL, currency).formatted}
              </span>
            </span>
          )}
          {hasClosedPeriod && (
            <span className="text-[10px] tabular-nums" data-private="true">
              <span className="text-muted-foreground">{stats.closedCount} closed</span>{" "}
              <span
                className={cn(
                  "font-medium",
                  stats.closedPL >= 0 ? "text-status-connected" : "text-status-disconnected",
                )}
              >
                {formatPnL(stats.closedPL, currency).formatted}
              </span>
              {(stats.wins > 0 || stats.losses > 0) && (
                <span className="text-muted-foreground ml-1">
                  <span className="text-status-connected">{stats.wins}W</span>
                  {" / "}
                  <span className="text-status-disconnected">{stats.losses}L</span>
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Merge stats for sources that map to the same module ─────────────────────

function mergeStats(...sources: (SourceStats | undefined)[]): SourceStats | null {
  let any = false
  const merged: SourceStats = { ...EMPTY_STATS }
  for (const s of sources) {
    if (!s) continue
    any = true
    merged.openCount += s.openCount
    merged.unrealizedPL += s.unrealizedPL
    merged.closedCount += s.closedCount
    merged.closedPL += s.closedPL
    merged.wins += s.wins
    merged.losses += s.losses
  }
  return any ? merged : null
}

// ─── Main bar ────────────────────────────────────────────────────────────────

export function AutomationBar() {
  const {
    tvAlertsStatus,
    tradeFinderScanStatus,
    lastAiTraderScanStatus,
    lastSmartFlowStatus,
    accountOverview,
  } = useDaemonStatus()
  const sourceStats = useSourceStats()
  const currency = accountOverview?.summary.currency ?? "USD"

  // TV Alerts stats (ut_bot_alerts source)
  const tvStats = sourceStats.get("ut_bot_alerts") ?? null

  // Trade Finder stats (trade_finder + trade_finder_auto sources)
  const tfStats = mergeStats(sourceStats.get("trade_finder"), sourceStats.get("trade_finder_auto"))

  // AI Trader stats
  const aiStats = sourceStats.get("ai_trader") ?? null

  // SmartFlow stats
  const sfStats = sourceStats.get("smart_flow") ?? null

  // Manual stats (oanda + manual sources — trades placed via FXFlow or directly on OANDA)
  const manualStats = mergeStats(sourceStats.get("oanda"), sourceStats.get("manual"))

  // TV Alerts status
  const tvStatus: Status = tvAlertsStatus
    ? tvAlertsStatus.circuitBreakerTripped
      ? "error"
      : tvAlertsStatus.enabled
        ? "active"
        : "disabled"
    : "disabled"
  const tvLine1 = tvAlertsStatus
    ? tvAlertsStatus.enabled
      ? `${tvAlertsStatus.signalCountToday ?? 0} signal${(tvAlertsStatus.signalCountToday ?? 0) !== 1 ? "s" : ""} today`
      : "Disabled"
    : "Not configured"

  // Trade Finder status
  const tfStatus: Status = tradeFinderScanStatus
    ? tradeFinderScanStatus.isScanning
      ? "scanning"
      : tradeFinderScanStatus.activeSetups > 0
        ? "active"
        : "idle"
    : "disabled"
  const tfLine1 = tradeFinderScanStatus
    ? tradeFinderScanStatus.isScanning
      ? `Scanning ${tradeFinderScanStatus.pairsScanned}/${tradeFinderScanStatus.totalPairs}`
      : `${tradeFinderScanStatus.activeSetups} active setup${tradeFinderScanStatus.activeSetups !== 1 ? "s" : ""}`
    : "Not configured"

  // AI Trader status
  const aiStatus: Status = lastAiTraderScanStatus
    ? lastAiTraderScanStatus.scanning
      ? "scanning"
      : lastAiTraderScanStatus.enabled
        ? "idle"
        : "disabled"
    : "disabled"
  const aiLine1 = lastAiTraderScanStatus
    ? lastAiTraderScanStatus.enabled
      ? lastAiTraderScanStatus.scanning
        ? "Scanning..."
        : `${lastAiTraderScanStatus.candidateCount} opportunit${lastAiTraderScanStatus.candidateCount !== 1 ? "ies" : "y"}`
      : "Disabled"
    : "Not configured"

  // SmartFlow status
  const sfStatus: Status = lastSmartFlowStatus
    ? lastSmartFlowStatus.enabled
      ? lastSmartFlowStatus.openTrades > 0
        ? "active"
        : "idle"
      : "disabled"
    : "disabled"
  const sfLine1 = lastSmartFlowStatus
    ? lastSmartFlowStatus.enabled
      ? `${lastSmartFlowStatus.openTrades} trade${lastSmartFlowStatus.openTrades !== 1 ? "s" : ""} managed`
      : "Disabled"
    : "Not configured"

  // Manual status — always "active" since it's always available
  const manualTotal = manualStats ? manualStats.openCount + manualStats.closedCount : 0
  const manualLine1 = manualStats
    ? `${manualTotal} trade${manualTotal !== 1 ? "s" : ""}`
    : "No trades"

  return (
    <div
      className={cn(
        "bg-card border-border/50 grid grid-cols-2 rounded-xl border lg:grid-cols-3 xl:grid-cols-5",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
      )}
      style={{ animationDelay: "200ms" }}
      role="region"
      aria-label="Automation status"
    >
      <ModuleSegment
        icon={MousePointer}
        name="Manual"
        status="active"
        line1={manualLine1}
        stats={manualStats}
        currency={currency}
        href="/positions"
      />
      <ModuleSegment
        icon={Radio}
        name="TV Alerts"
        status={tvStatus}
        line1={tvLine1}
        stats={tvStats}
        currency={currency}
        href="/tv-alerts"
        settingsHref="/settings/tv-alerts"
      />
      <ModuleSegment
        icon={Search}
        name="Trade Finder"
        status={tfStatus}
        line1={tfLine1}
        stats={tfStats}
        currency={currency}
        href="/trade-finder"
        settingsHref="/settings/trade-finder"
      />
      <ModuleSegment
        icon={Bot}
        name="EdgeFinder"
        status={aiStatus}
        line1={aiLine1}
        stats={aiStats}
        currency={currency}
        href="/ai-trader"
        settingsHref="/settings/ai-trader"
      />
      <ModuleSegment
        icon={Workflow}
        name="SmartFlow"
        status={sfStatus}
        line1={sfLine1}
        stats={sfStats}
        currency={currency}
        href="/smart-flow"
        settingsHref="/settings/smart-flow"
      />
    </div>
  )
}
