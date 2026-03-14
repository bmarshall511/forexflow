"use client"

import { useMemo, useState } from "react"
import { useTheme } from "next-themes"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts"
import { getRechartsTheme } from "@/lib/chart-theme"
import { BarChart3 } from "lucide-react"
import type { InstrumentPerformance } from "@fxflow/types"

interface PerfPairBreakdownProps {
  data: InstrumentPerformance[]
}

const DEFAULT_VISIBLE = 5

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: InstrumentPerformance }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="bg-popover border-border rounded-lg border p-2 text-xs shadow-lg">
      <p className="font-medium">{d.instrument.replace("_", "/")}</p>
      <p className="font-mono tabular-nums">P&L: ${d.totalPL.toFixed(2)}</p>
      <p className="font-mono tabular-nums">Win Rate: {(d.winRate * 100).toFixed(0)}%</p>
      <p className="text-muted-foreground">
        {d.wins}W / {d.losses}L
      </p>
    </div>
  )
}

export function PerfPairBreakdown({ data }: PerfPairBreakdownProps) {
  const { resolvedTheme } = useTheme()
  const theme = useMemo(() => getRechartsTheme(resolvedTheme === "dark"), [resolvedTheme])
  const [showAll, setShowAll] = useState(false)

  const sorted = useMemo(() => [...data].sort((a, b) => b.totalPL - a.totalPL), [data])

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_VISIBLE)
  const hasMore = sorted.length > DEFAULT_VISIBLE
  const chartHeight = Math.max(visible.length * 40, 120)

  if (data.length === 0) {
    return (
      <div className="border-border/50 bg-card rounded-xl border p-4">
        <div className="text-muted-foreground flex items-center gap-1.5">
          <BarChart3 className="size-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">Performance by Pair</span>
        </div>
        <p className="text-muted-foreground mt-8 text-center text-sm">No pair data yet</p>
      </div>
    )
  }

  return (
    <div className="border-border/50 bg-card rounded-xl border p-4">
      <div className="text-muted-foreground mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">Performance by Pair</span>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-primary text-xs font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {showAll ? "Show less" : `Show all ${sorted.length} pairs`}
          </button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={visible}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />

          <YAxis
            type="category"
            dataKey="instrument"
            tickFormatter={(v: string) => v.replace("_", "/")}
            stroke={theme.axis}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
          />

          <XAxis
            type="number"
            tickFormatter={(v: number) => `$${v}`}
            stroke={theme.axis}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.grid }} />

          <Bar dataKey="totalPL" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {visible.map((entry) => (
              <Cell key={entry.instrument} fill={entry.totalPL >= 0 ? theme.profit : theme.loss} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
