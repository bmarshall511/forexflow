"use client"

import { useMemo } from "react"
import type { PnLPeriod, TVSignalPeriodPnL } from "@fxflow/types"
import {
  Radio,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Zap,
  AlertTriangle,
  Settings2,
  Trophy,
  Percent,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react"
import Link from "next/link"
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { DataTile, InlineStat, ProportionBar } from "@/components/ui/data-tile"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { useTVAlertsConfig } from "@/hooks/use-tv-alerts-config"
import { useTVAlertsStats } from "@/hooks/use-tv-alerts-stats"
import { useTVAlertsPeriodPnL } from "@/hooks/use-tv-alerts-period-pnl"
import { formatPnL, type PnLColorIntent } from "@fxflow/shared"
import { cn } from "@/lib/utils"

// ─── Shared helpers ──────────────────────────────────────────────────────

const PNL_COLOR: Record<PnLColorIntent, string> = {
  positive: "text-status-connected",
  negative: "text-status-disconnected",
  neutral: "text-muted-foreground",
}

const VARIANT_MAP: Record<PnLColorIntent, "positive" | "negative" | "muted"> = {
  positive: "positive",
  negative: "negative",
  neutral: "muted",
}

const PNL_ICON: Record<PnLColorIntent, React.ElementType> = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
}

// ─── Period P&L helpers ───────────────────────────────────────────────────

const PERIOD_LABELS: Record<PnLPeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  thisMonth: "This Month",
  thisYear: "This Year",
  allTime: "All Time",
}

const PERIOD_ORDER: PnLPeriod[] = [
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "thisYear",
  "allTime",
]

const BAR_COLOR: Record<PnLColorIntent, string> = {
  positive: "bg-status-connected",
  negative: "bg-status-disconnected",
  neutral: "bg-muted-foreground/30",
}

const ACCENT_LEFT: Record<PnLColorIntent, string> = {
  positive: "border-l-status-connected",
  negative: "border-l-status-disconnected",
  neutral: "border-l-muted-foreground/30",
}

function PeriodPnLRow({
  label,
  data,
  barWidth,
}: {
  label: string
  data: TVSignalPeriodPnL
  barWidth: number
}) {
  const pnl = formatPnL(data.net, "USD")
  const tradeLabel = data.signalCount === 1 ? "1 signal" : `${data.signalCount} signals`

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm hover:bg-muted/20",
        ACCENT_LEFT[pnl.colorIntent],
      )}
    >
      <span className="w-20 shrink-0 text-left font-medium">{label}</span>

      <div className="flex flex-1 items-center">
        <div
          className={cn("h-1.5 rounded-full transition-all duration-500", BAR_COLOR[pnl.colorIntent])}
          style={{ width: `${Math.max(barWidth, 2)}%` }}
        />
      </div>

      {data.signalCount > 0 && (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {tradeLabel}
        </span>
      )}

      <AnimatedNumber
        value={pnl.formatted}
        className={cn(
          "w-24 shrink-0 text-right font-mono tabular-nums font-semibold",
          PNL_COLOR[pnl.colorIntent],
        )}
      />
    </div>
  )
}

function PnLPeriodsSection({ periodPnL }: { periodPnL: ReturnType<typeof useTVAlertsPeriodPnL>["data"] }) {
  const maxAbsNet = useMemo(() => {
    if (!periodPnL) return 1
    const values = PERIOD_ORDER.map((p) => Math.abs(periodPnL[p].net))
    return Math.max(...values, 1)
  }, [periodPnL])

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Signal P&L
      </h3>
      {periodPnL ? (
        <div className="space-y-1">
          {PERIOD_ORDER.map((period) => (
            <PeriodPnLRow
              key={period}
              label={PERIOD_LABELS[period]}
              data={periodPnL[period]}
              barWidth={(Math.abs(periodPnL[period].net) / maxAbsNet) * 100}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function TVAlertsCardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading TV alerts data" role="status">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="border-t border-border" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────

export function TVAlertsDashboardCard() {
  const { tvAlertsStatus, isConnected } = useDaemonStatus()
  const { config, isLoading: configLoading } = useTVAlertsConfig()
  const { stats, isLoading: statsLoading } = useTVAlertsStats()
  const { data: periodPnL } = useTVAlertsPeriodPnL()
  const s = tvAlertsStatus

  const moduleEnabled = s?.enabled ?? config?.enabled ?? false
  const cfConnected = s?.cfWorkerConnected ?? false
  const todayPL = s?.todayAutoPL ?? 0
  const circuitTripped = s?.circuitBreakerTripped ?? false

  // Not configured — prompt to set up
  if (!configLoading && config && !config.cfWorkerUrl && !config.webhookToken) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Radio className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">TradingView Alerts</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              Auto-trade from TradingView signals. Set up the CF Worker to get started.
            </p>
            <Link
              href="/settings/tv-alerts"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Settings2 className="size-3.5" />
              Configure
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (configLoading || statsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-4" />
            TradingView Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TVAlertsCardSkeleton />
        </CardContent>
      </Card>
    )
  }

  const todayPnl = formatPnL(todayPL, "USD")
  const TodayIcon = PNL_ICON[todayPnl.colorIntent]

  const totalPnl = stats ? formatPnL(stats.totalPL, "USD") : null
  const TotalIcon = totalPnl ? PNL_ICON[totalPnl.colorIntent] : Minus

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="size-4" />
          TradingView Alerts
        </CardTitle>
        <CardAction>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-[10px] font-medium",
              moduleEnabled ? "text-green-500" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                moduleEnabled && cfConnected ? "bg-green-500" : "bg-muted-foreground",
              )}
            />
            {moduleEnabled ? (cfConnected ? "Live" : "No Worker") : "Disabled"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── System Status ── */}
        <div>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            System Status
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <DataTile
              label="Module"
              value={moduleEnabled ? "Active" : "Disabled"}
              variant={moduleEnabled ? "positive" : "muted"}
              icon={<Activity className="size-3.5" />}
            />
            <DataTile
              label="CF Worker"
              value={!isConnected ? "No daemon" : cfConnected ? "Connected" : "Disconnected"}
              variant={!isConnected ? "muted" : cfConnected ? "positive" : "negative"}
              icon={<Radio className="size-3.5" />}
            />
            <DataTile
              label="Circuit Breaker"
              value={circuitTripped ? "TRIPPED" : "OK"}
              variant={circuitTripped ? "negative" : "positive"}
              icon={circuitTripped ? <AlertTriangle className="size-3.5" /> : <Shield className="size-3.5" />}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* ── Today ── */}
        <div>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Today
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <DataTile
              label="Today P&L"
              value={todayPnl.formatted}
              variant={VARIANT_MAP[todayPnl.colorIntent]}
              icon={<TodayIcon className="size-3.5" />}
            />
            <DataTile
              label="Signals"
              value={s?.signalCountToday ?? 0}
              variant="accent"
              icon={<Zap className="size-3.5" />}
            />
            <DataTile
              label="Positions"
              value={s?.activeAutoPositions ?? 0}
              variant="muted"
              icon={<TrendingUp className="size-3.5" />}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* ── P&L by Period ── */}
        <PnLPeriodsSection periodPnL={periodPnL} />

        <div className="border-t border-border" />

        {/* ── All-Time Performance ── */}
        <div>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            All-Time Performance
          </h3>
          {stats && stats.totalSignals > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <DataTile
                  label="W / L"
                  value={
                    <>
                      <span className="text-status-connected">{stats.wins}W</span>
                      {" / "}
                      <span className="text-status-disconnected">{stats.losses}L</span>
                    </>
                  }
                  variant="muted"
                  icon={<Trophy className="size-3.5" />}
                />
                <DataTile
                  label="Win Rate"
                  value={`${stats.winRate.toFixed(1)}%`}
                  variant={stats.winRate >= 50 ? "positive" : "negative"}
                  icon={<Percent className="size-3.5" />}
                />
                <DataTile
                  label="Profit Factor"
                  value={stats.profitFactor >= 999999 ? "\u221E" : stats.profitFactor.toFixed(2)}
                  variant={stats.profitFactor >= 1 ? "positive" : "negative"}
                  icon={<BarChart3 className="size-3.5" />}
                />
                <DataTile
                  label="Total P&L"
                  value={totalPnl!.formatted}
                  variant={VARIANT_MAP[totalPnl!.colorIntent]}
                  icon={<TotalIcon className="size-3.5" />}
                />
                <DataTile
                  label="Avg Win"
                  value={`$${stats.averageWin.toFixed(2)}`}
                  variant="positive"
                  icon={<CheckCircle2 className="size-3.5" />}
                />
                <DataTile
                  label="Avg Loss"
                  value={`$${stats.averageLoss.toFixed(2)}`}
                  variant="negative"
                  icon={<XCircle className="size-3.5" />}
                />
              </div>

              {/* Signal Breakdown */}
              <div className="mt-4">
                <ProportionBar
                  segments={[
                    { value: stats.executedSignals, color: "var(--color-status-connected)", label: "Executed" },
                    { value: stats.rejectedSignals, color: "var(--color-status-warning)", label: "Rejected" },
                    { value: stats.failedSignals, color: "var(--color-status-disconnected)", label: "Failed" },
                  ]}
                />
              </div>
            </>
          ) : (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No signal data yet
            </p>
          )}
        </div>

        <div className="border-t border-border" />

        {/* ── Configuration ── */}
        {config && (
          <>
            <div>
              <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Configuration
              </h3>
              <div className="rounded-lg bg-muted/30 px-3 py-2 space-y-0.5">
                <InlineStat label="Position Size" value={`${config.positionSizePercent}%`} />
                <InlineStat label="Cooldown" value={`${config.cooldownSeconds}s`} />
                <InlineStat label="Max Positions" value={String(config.maxOpenPositions)} />
                <InlineStat
                  label="Daily Loss Limit"
                  value={config.dailyLossLimit > 0 ? `$${config.dailyLossLimit}` : "Off"}
                />
                <InlineStat
                  label="Pair Whitelist"
                  value={config.pairWhitelist.length > 0 ? `${config.pairWhitelist.length} pairs` : "All"}
                />
                <InlineStat label="Market Hours" value={config.marketHoursFilter ? "On" : "Off"} />
              </div>
            </div>

            <div className="border-t border-border" />
          </>
        )}

        {/* ── Links ── */}
        <div className="flex items-center justify-between">
          <Link
            href="/tv-alerts"
            className="text-xs font-medium text-primary hover:underline"
            aria-label="View full TV alerts dashboard"
          >
            View full dashboard &rarr;
          </Link>
          <Link
            href="/settings/tv-alerts"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="TV alerts settings"
          >
            <Settings2 className="size-3" />
            Settings
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
