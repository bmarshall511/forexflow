"use client"

import { useState, useMemo } from "react"
import type { PeriodPnL, PnLPeriod } from "@fxflow/types"
import { formatPnL, type PnLColorIntent } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/animated-number"

interface PnLPeriodsSectionProps {
  pnl: Record<PnLPeriod, PeriodPnL>
  currency: string
}

const PERIOD_LABELS: Record<PnLPeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  thisMonth: "This Month",
  thisYear: "This Year",
  allTime: "All Time",
}

/** Only the historical periods — today has its own dedicated section */
const PERIOD_ORDER: PnLPeriod[] = [
  "yesterday",
  "thisWeek",
  "thisMonth",
  "thisYear",
  "allTime",
]

const NET_COLOR: Record<PnLColorIntent, string> = {
  positive: "text-status-connected",
  negative: "text-status-disconnected",
  neutral: "text-muted-foreground",
}

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

function PnLPeriodRow({
  label,
  data,
  currency,
  barWidth,
  showCommission,
}: {
  label: string
  data: PeriodPnL
  currency: string
  barWidth: number
  showCommission: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const netPnl = formatPnL(data.net, currency)
  const tradeLabel =
    data.tradeCount < 0
      ? ""
      : data.tradeCount === 1
        ? "1 trade"
        : `${data.tradeCount} trades`

  return (
    <div
      className={cn(
        "rounded-lg border-l-2 transition-colors",
        ACCENT_LEFT[netPnl.colorIntent],
        expanded ? "bg-muted/30" : "hover:bg-muted/20",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-sm"
        aria-expanded={expanded}
        aria-label={`${label}: ${netPnl.formatted}${tradeLabel ? `, ${tradeLabel}` : ""}`}
      >
        {/* Period label */}
        <span className="w-20 shrink-0 text-left font-medium">{label}</span>

        {/* Visual bar */}
        <div className="flex flex-1 items-center">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              BAR_COLOR[netPnl.colorIntent],
            )}
            style={{ width: `${Math.max(barWidth, 2)}%` }}
          />
        </div>

        {/* Trade count */}
        {tradeLabel && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {tradeLabel}
          </span>
        )}

        {/* Net P&L */}
        <AnimatedNumber
          value={netPnl.formatted}
          className={cn(
            "w-24 shrink-0 text-right font-mono tabular-nums font-semibold",
            NET_COLOR[netPnl.colorIntent],
          )}
        />

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="mx-3 mb-2.5 space-y-1 border-t border-border/50 pt-2">
          <BreakdownRow
            label="Realized P&L"
            value={data.realizedPL}
            currency={currency}
          />
          <BreakdownRow
            label="Financing"
            value={data.financing}
            currency={currency}
          />
          {showCommission && (
            <BreakdownRow
              label="Commission"
              value={data.commission}
              currency={currency}
            />
          )}
        </div>
      )}
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  currency,
}: {
  label: string
  value: number
  currency: string
}) {
  const formatted = formatPnL(value, currency)
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("font-mono tabular-nums", NET_COLOR[formatted.colorIntent])}
      >
        {formatted.formatted}
      </span>
    </div>
  )
}

export function PnLPeriodsSection({ pnl, currency }: PnLPeriodsSectionProps) {
  // Calculate max absolute net for proportional bars
  const maxAbsNet = useMemo(() => {
    const values = PERIOD_ORDER.map((p) => Math.abs(pnl[p].net))
    return Math.max(...values, 1)
  }, [pnl])

  // Check if commission is non-zero in any period
  const hasCommission = useMemo(
    () => PERIOD_ORDER.some((p) => Math.abs(pnl[p].commission) > 0.005),
    [pnl],
  )

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Historical P&L
      </h3>
      <div className="space-y-1">
        {PERIOD_ORDER.map((period) => (
          <PnLPeriodRow
            key={period}
            label={PERIOD_LABELS[period]}
            data={pnl[period]}
            currency={currency}
            barWidth={(Math.abs(pnl[period].net) / maxAbsNet) * 100}
            showCommission={hasCommission}
          />
        ))}
      </div>
    </div>
  )
}
