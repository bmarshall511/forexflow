"use client"

import { cn } from "@/lib/utils"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { formatCurrency } from "@fxflow/shared"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import Link from "next/link"

function formatCompactCurrency(value: number, currency: string): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${value < 0 ? "-" : ""}${currency === "USD" ? "$" : ""}${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 10_000) {
    return `${value < 0 ? "-" : ""}${currency === "USD" ? "$" : ""}${(abs / 1_000).toFixed(1)}K`
  }
  return formatCurrency(value, currency)
}

function formatSignedCurrency(value: number, currency: string): string {
  const formatted = formatCurrency(Math.abs(value), currency)
  if (value > 1e-8) return `+${formatted}`
  if (value < -1e-8) return `-${formatted}`
  return formatted
}

interface SummaryRowProps {
  label: string
  value: string
  colored?: boolean
  numericValue?: number
}

function SummaryRow({ label, value, colored, numericValue }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          colored &&
            numericValue !== undefined &&
            numericValue > 1e-8 &&
            "text-status-connected font-semibold",
          colored &&
            numericValue !== undefined &&
            numericValue < -1e-8 &&
            "text-status-disconnected font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function HeaderAccountInfo() {
  const { accountOverview } = useDaemonStatus()
  const { openWithPrices } = usePositions()

  const summary = accountOverview?.summary
  const balance = summary?.balance ?? 0
  const nav = summary?.nav ?? 0
  const currency = summary?.currency ?? "USD"
  const totalUnrealized = openWithPrices.reduce((sum, t) => sum + t.unrealizedPL, 0)
  const marginUsed = summary?.marginUsed ?? 0
  const marginAvailable = summary?.marginAvailable ?? 0
  const marginTotal = marginUsed + marginAvailable
  const marginUsedPct = marginTotal > 0 ? (marginUsed / marginTotal) * 100 : 0
  const todayPL = accountOverview?.pnl?.today?.net ?? 0

  const hasData = accountOverview !== null

  const uplColor =
    totalUnrealized > 1e-8
      ? "text-status-connected"
      : totalUnrealized < -1e-8
        ? "text-status-disconnected"
        : "text-muted-foreground"

  const balanceDisplay = !hasData ? "\u2014" : formatCurrency(balance, currency)
  const uplDisplay = !hasData ? "\u2014" : formatSignedCurrency(totalUnrealized, currency)

  const compactBalance = !hasData ? "\u2014" : formatCompactCurrency(balance, currency)

  const compactUpl = !hasData ? "\u2014" : formatSignedCurrency(totalUnrealized, currency)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "bg-muted/50 flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1",
            "hover:bg-accent/50 transition-colors",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
          )}
          aria-label={
            hasData
              ? `Account balance ${formatCurrency(balance, currency)}, unrealized ${formatSignedCurrency(totalUnrealized, currency)}`
              : "Account info unavailable"
          }
        >
          {/* Balance */}
          <span className="@7xl/header:inline text-muted-foreground hidden text-[11px]">
            Balance
          </span>
          <span className="@5xl/header:inline @7xl/header:hidden text-muted-foreground hidden text-[11px]">
            Bal
          </span>
          <span className="text-foreground font-mono text-xs font-semibold tabular-nums">
            <span className="@5xl/header:hidden">{compactBalance}</span>
            <span className="@5xl/header:inline hidden">{balanceDisplay}</span>
          </span>

          <span className="text-border" aria-hidden="true">
            &middot;
          </span>

          {/* Unrealized P/L */}
          <span className="@7xl/header:inline text-muted-foreground hidden text-[11px]">
            Unrealized P/L
          </span>
          <span className="@5xl/header:inline @7xl/header:hidden text-muted-foreground hidden text-[11px]">
            UPL
          </span>
          <span
            className={cn(
              "font-mono text-xs font-semibold tabular-nums",
              hasData ? uplColor : "text-muted-foreground",
            )}
          >
            <span className="@5xl/header:hidden">{compactUpl}</span>
            <span className="@5xl/header:inline hidden">{uplDisplay}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Account Overview</h4>

          {!hasData ? (
            <p className="text-muted-foreground text-xs">
              Account data unavailable. Check daemon connection.
            </p>
          ) : (
            <div className="space-y-1.5">
              <SummaryRow label="Balance" value={formatCurrency(balance, currency)} />
              <SummaryRow label="NAV" value={formatCurrency(nav, currency)} />
              <SummaryRow
                label="Unrealized P/L"
                value={formatSignedCurrency(totalUnrealized, currency)}
                colored
                numericValue={totalUnrealized}
              />
              <SummaryRow label="Margin Used" value={`${marginUsedPct.toFixed(1)}%`} />
              <SummaryRow
                label="Today's P/L"
                value={formatSignedCurrency(todayPL, currency)}
                colored
                numericValue={todayPL}
              />
            </div>
          )}

          <Link
            href="/"
            className="text-primary border-border block border-t pt-1 text-xs hover:underline"
          >
            View Dashboard &rarr;
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
