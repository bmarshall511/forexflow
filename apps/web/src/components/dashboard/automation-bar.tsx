"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { formatPnL } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Radio, Search, Bot, Settings, MousePointer, Workflow } from "lucide-react"
import type { TradeSource } from "@fxflow/types"

// ─── Source stats helper ────────────────────────────────────────────────────

interface SourceStats {
  openCount: number
  unrealizedPL: number
  closedTodayCount: number
  closedTodayPL: number
}

const EMPTY_STATS: SourceStats = {
  openCount: 0,
  unrealizedPL: 0,
  closedTodayCount: 0,
  closedTodayPL: 0,
}

function useSourceStats() {
  const { openWithPrices, positions } = usePositions()

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

    for (const t of openWithPrices) {
      const s = get(t.source)
      s.openCount++
      s.unrealizedPL += t.unrealizedPL
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const t of positions?.closed ?? []) {
      if (new Date(t.closedAt) >= today) {
        const s = get(t.source)
        s.closedTodayCount++
        s.closedTodayPL += t.realizedPL
      }
    }

    return map
  }, [openWithPrices, positions?.closed])
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
  const hasClosedToday = stats && stats.closedTodayCount > 0

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
      {/* Live trade stats */}
      {(hasOpenTrades || hasClosedToday) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {hasOpenTrades && (
            <span className="text-[10px] tabular-nums">
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
          {hasClosedToday && (
            <span className="text-[10px] tabular-nums">
              <span className="text-muted-foreground">{stats.closedTodayCount} closed</span>{" "}
              <span
                className={cn(
                  "font-medium",
                  stats.closedTodayPL >= 0 ? "text-status-connected" : "text-status-disconnected",
                )}
              >
                {formatPnL(stats.closedTodayPL, currency).formatted}
              </span>
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
  const merged: SourceStats = {
    openCount: 0,
    unrealizedPL: 0,
    closedTodayCount: 0,
    closedTodayPL: 0,
  }
  for (const s of sources) {
    if (!s) continue
    any = true
    merged.openCount += s.openCount
    merged.unrealizedPL += s.unrealizedPL
    merged.closedTodayCount += s.closedTodayCount
    merged.closedTodayPL += s.closedTodayPL
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
  const manualLine1 = manualStats
    ? `${manualStats.openCount + manualStats.closedTodayCount} trade${manualStats.openCount + manualStats.closedTodayCount !== 1 ? "s" : ""} today`
    : "No trades today"

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
        name="AI Trader"
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
