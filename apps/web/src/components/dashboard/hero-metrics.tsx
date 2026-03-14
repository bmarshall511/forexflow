"use client"

import { useMemo } from "react"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { formatCurrency, formatPnL } from "@fxflow/shared"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { ProgressRing } from "@/components/ui/progress-ring"
import { DonutChart } from "@/components/ui/data-tile"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Wallet, TrendingUp, BarChart3, Target, ShieldCheck } from "lucide-react"

// ─── Individual metric tile ─────────────────────────────────────────────────

interface MetricProps {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  subtitle?: string
  className?: string
}

function Metric({ icon, label, children, subtitle, className }: MetricProps) {
  return (
    <div
      className={cn(
        "border-border/50 bg-card flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl border p-3 transition-shadow hover:shadow-sm",
        "snap-start",
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-lg font-semibold tabular-nums leading-tight">{children}</div>
      {subtitle && (
        <span className="text-muted-foreground text-[10px] tabular-nums">{subtitle}</span>
      )}
    </div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="border-border/50 flex min-w-[140px] flex-1 flex-col gap-2 rounded-xl border p-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// ─── Color helpers ───────────────────────────────────────────────────────────

const intentColor = {
  positive: "text-status-connected",
  negative: "text-status-disconnected",
  neutral: "text-muted-foreground",
} as const

// ─── Main component ─────────────────────────────────────────────────────────

export function HeroMetrics() {
  const { accountOverview, isConnected, oanda } = useDaemonStatus()
  const { summary, openWithPrices } = usePositions()

  const isLoaded = accountOverview !== null
  const isConfigured = oanda?.status !== "unconfigured"
  const currency = accountOverview?.summary.currency ?? "USD"

  const balance = accountOverview?.summary.balance ?? 0
  const todayPnl = accountOverview?.pnl.today

  const totalUnrealized = useMemo(
    () => openWithPrices.reduce((sum, t) => sum + t.unrealizedPL, 0),
    [openWithPrices],
  )

  const todayNet = todayPnl ? todayPnl.net : 0
  const todayPnlFormatted = formatPnL(todayNet, currency)
  const unrealizedFormatted = formatPnL(totalUnrealized, currency)

  const todayTotal = summary.todayWins + summary.todayLosses
  const winRate = todayTotal > 0 ? Math.round((summary.todayWins / todayTotal) * 100) : null

  const marginPercent = useMemo(() => {
    if (!accountOverview) return 0
    const { marginUsed, balance: bal } = accountOverview.summary
    if (bal <= 0) return 0
    return Math.round((marginUsed / bal) * 100)
  }, [accountOverview])

  // Not configured — show setup prompt
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
          Connect Account →
        </a>
      </div>
    )
  }

  // Loading state
  if (!isLoaded) {
    return (
      <div className="flex gap-3 overflow-x-auto px-4 md:px-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex gap-3 px-4 md:px-6",
        "scrollbar-none snap-x snap-mandatory overflow-x-auto",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
      )}
      role="region"
      aria-label="Key account metrics"
    >
      {/* Balance */}
      <Metric icon={<Wallet className="size-3.5" />} label="Balance">
        <AnimatedNumber value={formatCurrency(balance, currency)} />
      </Metric>

      {/* Today P&L */}
      <Metric
        icon={<TrendingUp className="size-3.5" />}
        label="Today"
        subtitle={
          todayPnl
            ? `${todayPnl.tradeCount} trade${todayPnl.tradeCount !== 1 ? "s" : ""} closed`
            : "No trades yet"
        }
      >
        <AnimatedNumber
          value={todayPnlFormatted.formatted}
          className={intentColor[todayPnlFormatted.colorIntent]}
        />
      </Metric>

      {/* Open P&L */}
      <Metric
        icon={<BarChart3 className="size-3.5" />}
        label="Open P&L"
        subtitle={
          summary.openCount > 0
            ? `${summary.openCount} position${summary.openCount !== 1 ? "s" : ""}`
            : "No open trades"
        }
      >
        <AnimatedNumber
          value={unrealizedFormatted.formatted}
          className={intentColor[unrealizedFormatted.colorIntent]}
        />
      </Metric>

      {/* Win Rate */}
      <Metric
        icon={<Target className="size-3.5" />}
        label="Win Rate"
        subtitle={
          todayTotal > 0 ? `${summary.todayWins}W / ${summary.todayLosses}L` : "No results yet"
        }
      >
        <div className="flex items-center gap-2">
          {winRate !== null ? (
            <>
              <DonutChart value={winRate} size={32} strokeWidth={3} />
              <span
                className={winRate >= 50 ? "text-status-connected" : "text-status-disconnected"}
              >
                {winRate}%
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </Metric>

      {/* Margin Usage */}
      <Metric
        icon={<ShieldCheck className="size-3.5" />}
        label="Margin"
        subtitle={`${formatCurrency(accountOverview.summary.marginUsed, currency)} used`}
      >
        <div className="flex items-center gap-2">
          <ProgressRing value={marginPercent} size={32} strokeWidth={3} />
          <span
            className={cn(
              marginPercent >= 60
                ? "text-status-disconnected"
                : marginPercent >= 30
                  ? "text-status-warning"
                  : "text-status-connected",
            )}
          >
            {marginPercent}%
          </span>
        </div>
      </Metric>
    </div>
  )
}
