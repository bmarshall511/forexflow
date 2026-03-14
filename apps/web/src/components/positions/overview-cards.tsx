"use client"

import type { PositionsData, OpenTradeData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Clock, Target, BarChart3, History } from "lucide-react"
import { cn } from "@/lib/utils"

interface OverviewCardsProps {
  positions: PositionsData | null
  openWithPrices: OpenTradeData[]
  currency?: string
}

function Tile({
  label,
  value,
  subtitle,
  icon,
  variant = "default",
}: {
  label: string
  value: React.ReactNode
  subtitle: string
  icon: React.ReactNode
  variant?: "default" | "positive" | "negative" | "muted"
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border p-4 transition-colors",
        variant === "positive" && "border-green-500/20 bg-green-500/[0.03]",
        variant === "negative" && "border-red-500/20 bg-red-500/[0.03]",
        variant === "muted" && "border-border/40 bg-muted/20",
        variant === "default" && "border-border/60 bg-card",
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={cn(
          "font-mono text-xl font-bold tabular-nums tracking-tight",
          variant === "positive" && "text-green-500",
          variant === "negative" && "text-red-500",
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground text-[11px] leading-tight">{subtitle}</div>
    </div>
  )
}

export function OverviewCards({ positions, openWithPrices, currency = "USD" }: OverviewCardsProps) {
  if (!positions) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card space-y-2 rounded-xl border p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    )
  }

  const { pending, open, closed } = positions
  const totalUnrealizedPL = openWithPrices.reduce((s, t) => s + t.unrealizedPL, 0)
  const totalMarginUsed = openWithPrices.reduce((s, t) => s + t.marginUsed, 0)

  const nearestPending = pending.length > 0 ? pending[0] : null

  const sorted = [...openWithPrices].sort((a, b) => b.unrealizedPL - a.unrealizedPL)
  const best = sorted.length > 0 ? sorted[0] : null
  const worst = sorted.length > 0 ? sorted[sorted.length - 1] : null

  const todayWins = closed.filter((t) => t.outcome === "win").length
  const todayLosses = closed.filter((t) => t.outcome === "loss").length
  const todayNetPL = closed.reduce((s, t) => s + t.realizedPL + t.financing, 0)
  const winRate = closed.length > 0 ? ((todayWins / closed.length) * 100).toFixed(0) : "—"

  const latestClose = closed.length > 0 ? closed[0] : null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Tile
        label="Open P/L"
        value={formatCurrency(totalUnrealizedPL, currency)}
        variant={
          totalUnrealizedPL >= 0.005
            ? "positive"
            : totalUnrealizedPL <= -0.005
              ? "negative"
              : "default"
        }
        subtitle={`${open.length} trade${open.length !== 1 ? "s" : ""} open · ${formatCurrency(totalMarginUsed, currency)} margin`}
        icon={<BarChart3 className="size-3.5" />}
      />

      <Tile
        label="Pending"
        value={nearestPending ? nearestPending.instrument.replace("_", "/") : "—"}
        subtitle={
          nearestPending
            ? `${nearestPending.direction === "long" ? "Buy" : "Sell"} ${nearestPending.orderType}`
            : "No orders waiting"
        }
        icon={<Target className="size-3.5" />}
        variant="muted"
      />

      <Tile
        label="Best Trade"
        value={best ? best.instrument.replace("_", "/") : "—"}
        variant={best && best.unrealizedPL >= 0 ? "positive" : "default"}
        subtitle={best ? formatCurrency(best.unrealizedPL, currency) : "No open trades"}
        icon={<TrendingUp className="size-3.5" />}
      />

      <Tile
        label="Worst Trade"
        value={worst ? worst.instrument.replace("_", "/") : "—"}
        variant={worst && worst.unrealizedPL < 0 ? "negative" : "default"}
        subtitle={worst ? formatCurrency(worst.unrealizedPL, currency) : "No open trades"}
        icon={<TrendingDown className="size-3.5" />}
      />

      <Tile
        label="Today"
        value={closed.length > 0 ? `${todayWins}W / ${todayLosses}L` : "—"}
        variant={closed.length > 0 ? (todayNetPL >= 0 ? "positive" : "negative") : "muted"}
        subtitle={
          closed.length > 0
            ? `${winRate}% win rate · ${formatCurrency(todayNetPL, currency)}`
            : "No trades closed today"
        }
        icon={<Clock className="size-3.5" />}
      />

      <Tile
        label="Last Close"
        value={latestClose ? latestClose.instrument.replace("_", "/") : "—"}
        variant={latestClose ? (latestClose.realizedPL >= 0 ? "positive" : "negative") : "muted"}
        subtitle={
          latestClose
            ? `${latestClose.outcome === "win" ? "+" : ""}${formatCurrency(latestClose.realizedPL, currency)}`
            : "No trades closed today"
        }
        icon={<History className="size-3.5" />}
      />
    </div>
  )
}
