"use client"

import { useMemo } from "react"
import { Wallet, TrendingUp, BarChart3, ShieldCheck, Crosshair } from "lucide-react"
import { formatCurrency, formatPnL } from "@fxflow/shared"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { ProgressRing } from "@/components/ui/progress-ring"
import { Skeleton } from "@/components/ui/skeleton"
import { MetricTile, LivePulse } from "@/components/dashboard/shared"
import { cn } from "@/lib/utils"

/**
 * Live strip — five always-current tiles at the top of the dashboard.
 *
 * Data source is the daemon's WS-driven AccountOverview + live open-trade
 * unrealized P&L. "Day Change" combines realized-today (from
 * `accountOverview.pnl.today.net`) with the live sum of unrealized P&L so
 * the user's "what did I make today?" answer doesn't lie while a loser
 * is still open.
 *
 * Every monetary value is marked `private` so the PrivacyToggle can blur
 * them in one click.
 */
export function LiveStrip() {
  const { accountOverview, oanda } = useDaemonStatus()
  const { summary, openWithPrices } = usePositions()

  const isConfigured = oanda?.status !== "unconfigured"
  const isLoaded = accountOverview !== null
  const currency = accountOverview?.summary.currency ?? "USD"

  const totalUnrealized = useMemo(
    () => openWithPrices.reduce((sum, t) => sum + t.unrealizedPL, 0),
    [openWithPrices],
  )

  // Hoist hook-derived margin percent above conditional returns so hook order
  // stays stable across renders.
  const marginPercent = useMemo(() => {
    if (!accountOverview) return 0
    const { marginUsed, balance: bal } = accountOverview.summary
    if (bal <= 0) return 0
    return Math.round((marginUsed / bal) * 100)
  }, [accountOverview])

  if (!isConfigured) {
    return (
      <div className="mx-4 rounded-xl border border-dashed p-6 text-center md:mx-6">
        <Wallet className="text-muted-foreground mx-auto mb-2 size-8" />
        <p className="text-sm font-medium">Connect your trading account</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Link your OANDA account to see live metrics
        </p>
        <a
          href="/settings/oanda"
          className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
        >
          Connect account →
        </a>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex gap-3 overflow-x-auto px-4 md:px-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] min-w-[140px] flex-1 rounded-xl" />
        ))}
      </div>
    )
  }

  const balance = accountOverview.summary.balance
  const realizedToday = accountOverview.pnl.today.net
  // Day change = realized P&L from closed trades today + unrealized P&L on
  // everything still open right now. Matches how OANDA's NAV drifts.
  const dayChange = realizedToday + totalUnrealized
  const dayChangePnL = formatPnL(dayChange, currency)
  const unrealizedPnL = formatPnL(totalUnrealized, currency)

  const marginTone = marginPercent >= 60 ? "negative" : marginPercent >= 30 ? "warning" : "neutral"

  return (
    <div
      className={cn(
        "flex gap-3 px-4 md:px-6",
        "scrollbar-none snap-x snap-mandatory overflow-x-auto sm:overflow-visible",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
      )}
      role="region"
      aria-label="Live account metrics"
    >
      <MetricTile
        icon={<Wallet className="size-3.5" />}
        label="Balance"
        private
        value={
          <LivePulse>
            <AnimatedNumber value={formatCurrency(balance, currency)} />
          </LivePulse>
        }
        subtitle={accountOverview.summary.alias ?? undefined}
        className="snap-start"
      />

      <MetricTile
        icon={<TrendingUp className="size-3.5" />}
        label="Day change"
        tone={dayChangePnL.colorIntent}
        private
        value={
          <LivePulse>
            <AnimatedNumber value={dayChangePnL.formatted} />
          </LivePulse>
        }
        subtitle={
          <>
            Closed {formatPnL(realizedToday, currency).formatted} · Open {unrealizedPnL.formatted}
          </>
        }
        className="snap-start"
      />

      <MetricTile
        icon={<BarChart3 className="size-3.5" />}
        label="Open P&L"
        tone={unrealizedPnL.colorIntent}
        private
        value={
          <LivePulse>
            <AnimatedNumber value={unrealizedPnL.formatted} />
          </LivePulse>
        }
        subtitle={
          summary.openCount > 0
            ? `${summary.openCount} position${summary.openCount !== 1 ? "s" : ""}`
            : "No open trades"
        }
        className="snap-start"
      />

      <MetricTile
        icon={<ShieldCheck className="size-3.5" />}
        label="Margin"
        tone={marginTone}
        value={
          <div className="flex items-center gap-2">
            <ProgressRing value={marginPercent} size={32} strokeWidth={3} />
            <span>{marginPercent}%</span>
          </div>
        }
        subtitle={
          <span data-private="true">
            {formatCurrency(accountOverview.summary.marginUsed, currency)} used
          </span>
        }
        className="snap-start"
      />

      <MetricTile
        icon={<Crosshair className="size-3.5" />}
        label="Active"
        value={summary.openCount + summary.pendingCount}
        subtitle={
          <>
            {summary.openCount} open
            {summary.pendingCount > 0 && <> · {summary.pendingCount} pending</>}
          </>
        }
        className="snap-start"
      />
    </div>
  )
}
