"use client"

import { useMemo } from "react"
import { useTheme } from "next-themes"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts"
import { getRechartsTheme } from "@/lib/chart-theme"
import { TrendingUp } from "lucide-react"
import type { EquityCurvePoint } from "@fxflow/types"

interface PerfEquityCurveProps {
  data: EquityCurvePoint[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const value = payload[0]!.value
  return (
    <div className="bg-popover border-border rounded-lg border p-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{formatDate(label)}</p>
      <p className="font-mono font-semibold tabular-nums">${value.toFixed(2)}</p>
    </div>
  )
}

export function PerfEquityCurve({ data }: PerfEquityCurveProps) {
  const { resolvedTheme } = useTheme()
  const theme = useMemo(() => getRechartsTheme(resolvedTheme === "dark"), [resolvedTheme])

  const lineColor = useMemo(() => {
    if (data.length === 0) return theme.profit
    return data.at(-1)!.cumulativePL >= 0 ? theme.profit : theme.loss
  }, [data, theme])

  const gradientId = "equityCurveGradient"

  if (data.length < 2) {
    return (
      <div className="border-border/50 bg-card rounded-xl border p-4">
        <div className="text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="size-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">Profit Over Time</span>
        </div>
        <p className="text-muted-foreground mt-8 text-center text-sm">Not enough data yet</p>
      </div>
    )
  }

  return (
    <div className="border-border/50 bg-card rounded-xl border p-4">
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5">
        <TrendingUp className="size-3.5" />
        <span className="text-xs font-medium uppercase tracking-wider">Profit Over Time</span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke={theme.axis}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            tickFormatter={(v: number) => `$${v}`}
            stroke={theme.axis}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />

          <ReferenceLine y={0} stroke={theme.axis} strokeDasharray="3 3" />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="cumulativePL"
            stroke={lineColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
