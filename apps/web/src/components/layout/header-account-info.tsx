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
  if (value >= 0.005) return `+${formatted}`
  if (value <= -0.005) return `-${formatted}`
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
          colored && numericValue !== undefined && numericValue >= 0.005 && "text-status-connected font-semibold",
          colored && numericValue !== undefined && numericValue <= -0.005 && "text-status-disconnected font-semibold",
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

  const uplColor = totalUnrealized >= 0.005
    ? "text-status-connected"
    : totalUnrealized <= -0.005
      ? "text-status-disconnected"
      : "text-muted-foreground"

  const balanceDisplay = !hasData ? "\u2014" : formatCurrency(balance, currency)
  const uplDisplay = !hasData ? "\u2014" : formatSignedCurrency(totalUnrealized, currency)

  const compactBalance = !hasData
    ? "\u2014"
    : formatCompactCurrency(balance, currency)

  const compactUpl = !hasData
    ? "\u2014"
    : formatSignedCurrency(totalUnrealized, currency)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-1 whitespace-nowrap",
            "hover:bg-accent/50 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={
            hasData
              ? `Account balance ${formatCurrency(balance, currency)}, unrealized ${formatSignedCurrency(totalUnrealized, currency)}`
              : "Account info unavailable"
          }
        >
          {/* Balance */}
          <span className="hidden @7xl/header:inline text-[11px] text-muted-foreground">Balance</span>
          <span className="hidden @5xl/header:inline @7xl/header:hidden text-[11px] text-muted-foreground">Bal</span>
          <span className="text-xs font-mono tabular-nums font-semibold text-foreground">
            <span className="@5xl/header:hidden">{compactBalance}</span>
            <span className="hidden @5xl/header:inline">{balanceDisplay}</span>
          </span>

          <span className="text-border" aria-hidden="true">&middot;</span>

          {/* Unrealized P/L */}
          <span className="hidden @7xl/header:inline text-[11px] text-muted-foreground">Unrealized P/L</span>
          <span className="hidden @5xl/header:inline @7xl/header:hidden text-[11px] text-muted-foreground">UPL</span>
          <span className={cn("text-xs font-mono tabular-nums font-semibold", hasData ? uplColor : "text-muted-foreground")}>
            <span className="@5xl/header:hidden">{compactUpl}</span>
            <span className="hidden @5xl/header:inline">{uplDisplay}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Account Overview</h4>

          {!hasData ? (
            <p className="text-xs text-muted-foreground">
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
            className="block text-xs text-primary hover:underline pt-1 border-t border-border"
          >
            View Dashboard &rarr;
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
