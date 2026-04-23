"use client"

import { useMemo } from "react"
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts"
import type { EquityCurvePoint, DrawdownPoint } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"

/**
 * Performance Hero chart — balance (or cumulative P&L) line on top of a
 * drawdown band. Split out from the parent so the parent stays under the
 * 150-LOC component limit and can hot-swap the "Balance vs. Cumulative"
 * toggle without re-renders of the whole hero.
 *
 * Live "NAV tail" — the last data point extends to `liveBalance` as a
 * dashed segment so the chart stays honest while trades are open. When no
 * live balance is available it's skipped.
 */
interface PerformanceHeroChartProps {
  equity: EquityCurvePoint[]
  drawdown: DrawdownPoint[]
  variant: "balance" | "cumulative"
  currency: string
  /** Current NAV — balance + unrealized — for the dashed live tail. Optional. */
  liveBalance?: number | null
  height?: number
  className?: string
}

interface MergedPoint {
  date: string
  value: number
  drawdown: number
  peakBalance: number
}

function mergePoints(
  equity: EquityCurvePoint[],
  drawdown: DrawdownPoint[],
  variant: "balance" | "cumulative",
): MergedPoint[] {
  const byDate = new Map<string, MergedPoint>()
  for (const p of equity) {
    const value = variant === "balance" ? (p.balance ?? p.cumulativePL) : p.cumulativePL
    byDate.set(p.date, { date: p.date, value, drawdown: 0, peakBalance: value })
  }
  for (const d of drawdown) {
    const m = byDate.get(d.date)
    if (m) {
      m.drawdown = d.drawdown
      m.peakBalance = d.peakBalance
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function ChartTooltip({
  active,
  payload,
  currency,
  variant,
}: TooltipProps<number, string> & { currency: string; variant: "balance" | "cumulative" }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as MergedPoint | undefined
  if (!row) return null
  const label = variant === "balance" ? "Balance" : "Cumulative P&L"
  return (
    <div className="bg-popover border-border rounded-md border p-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1 font-medium">{row.date}</p>
      <p className="tabular-nums" data-private="true">
        {label}: <span className="font-semibold">{formatCurrency(row.value, currency)}</span>
      </p>
      {row.drawdown < 0 && (
        <p className="text-status-disconnected tabular-nums" data-private="true">
          Drawdown: {formatCurrency(row.drawdown, currency)}
        </p>
      )}
    </div>
  )
}

export function PerformanceHeroChart({
  equity,
  drawdown,
  variant,
  currency,
  liveBalance,
  height = 220,
  className,
}: PerformanceHeroChartProps) {
  const points = useMemo(() => mergePoints(equity, drawdown, variant), [equity, drawdown, variant])

  // Append a dashed live NAV tail when we have one and it differs from the
  // last recorded day's balance. Recharts picks up the extra point via the
  // same Area series but we slot in a virtual key so the tooltip can read it.
  const withTail = useMemo(() => {
    if (!points.length || liveBalance == null) return points
    const last = points[points.length - 1]!
    if (Math.abs(liveBalance - last.value) < 0.01) return points
    return [
      ...points,
      {
        date: "now",
        value: liveBalance,
        drawdown: 0,
        peakBalance: Math.max(last.peakBalance, liveBalance),
      },
    ]
  }, [points, liveBalance])

  if (points.length < 2) {
    return (
      <div
        className={cn("text-muted-foreground flex items-center justify-center text-sm", className)}
        style={{ height }}
      >
        Not enough data for this period yet
      </div>
    )
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={withTail} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="hero-pos" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-status-connected, #22c55e)"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="var(--color-status-connected, #22c55e)"
                stopOpacity={0.02}
              />
            </linearGradient>
            <linearGradient id="hero-dd" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-status-disconnected, #ef4444)"
                stopOpacity={0}
              />
              <stop
                offset="100%"
                stopColor="var(--color-status-disconnected, #ef4444)"
                stopOpacity={0.18}
              />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis yAxisId="value" domain={["auto", "auto"]} hide />
          <YAxis yAxisId="drawdown" orientation="right" domain={["dataMin", 0]} hide />
          <Tooltip content={<ChartTooltip currency={currency} variant={variant} />} />
          <Area
            yAxisId="drawdown"
            dataKey="drawdown"
            type="monotone"
            stroke="none"
            fill="url(#hero-dd)"
            isAnimationActive={false}
          />
          <Area
            yAxisId="value"
            dataKey="value"
            type="monotone"
            stroke="var(--color-status-connected, #22c55e)"
            strokeWidth={1.5}
            fill="url(#hero-pos)"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
