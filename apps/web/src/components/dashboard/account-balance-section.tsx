"use client"

import type { AccountSummaryData } from "@fxflow/types"
import { formatCurrency, formatPnL, type PnLColorIntent } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Progress } from "@/components/ui/progress"
import { Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface AccountBalanceSectionProps {
  summary: AccountSummaryData
  currency: string
  /** Live-computed unrealized P&L from streaming prices (overrides summary.unrealizedPL) */
  liveUnrealizedPL?: number
}

const PNL_ICON: Record<PnLColorIntent, React.ElementType> = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
}

const PNL_COLOR: Record<PnLColorIntent, string> = {
  positive: "text-status-connected",
  negative: "text-status-disconnected",
  neutral: "text-muted-foreground",
}

function getMarginBarColor(pct: number): string {
  if (pct < 30) return "bg-status-connected"
  if (pct < 60) return "bg-status-warning"
  return "bg-status-disconnected"
}

export function AccountBalanceSection({
  summary,
  currency,
  liveUnrealizedPL,
}: AccountBalanceSectionProps) {
  const unrealized = formatPnL(liveUnrealizedPL ?? summary.unrealizedPL, currency)
  const UnrealizedIcon = PNL_ICON[unrealized.colorIntent]
  const marginPct = summary.nav > 0 ? (summary.marginUsed / summary.nav) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Primary metrics row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Balance — hero metric */}
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider">
            <Wallet className="size-3" />
            Balance
          </div>
          <AnimatedNumber
            value={formatCurrency(summary.balance, currency)}
            className="block text-2xl font-bold tabular-nums tracking-tight"
          />
        </div>

        {/* Unrealized P&L */}
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider">
            <UnrealizedIcon className="size-3" />
            Unrealized P&L
          </div>
          <AnimatedNumber
            value={unrealized.formatted}
            className={cn(
              "block font-mono text-2xl font-semibold tabular-nums tracking-tight",
              PNL_COLOR[unrealized.colorIntent],
            )}
          />
        </div>
      </div>

      {/* Margin progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Margin Utilization</span>
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              marginPct >= 60 && "text-status-disconnected",
              marginPct >= 30 && marginPct < 60 && "text-status-warning",
            )}
          >
            {marginPct.toFixed(1)}%
          </span>
        </div>
        <Progress
          value={marginPct}
          max={100}
          className="h-2.5"
          indicatorClassName={getMarginBarColor(marginPct)}
          aria-label={`Margin utilization: ${marginPct.toFixed(1)}%`}
        />
        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
          <span>
            Used:{" "}
            <span className="font-mono tabular-nums">
              {formatCurrency(summary.marginUsed, currency)}
            </span>
          </span>
          <span>
            Available:{" "}
            <span className="font-mono tabular-nums">
              {formatCurrency(summary.marginAvailable, currency)}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
