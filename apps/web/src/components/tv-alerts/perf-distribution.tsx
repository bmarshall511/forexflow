"use client"

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
  ReferenceLine,
} from "recharts"
import { BarChart3 } from "lucide-react"
import { getRechartsTheme } from "@/lib/chart-theme"
import type { TVSignalPnLBucket } from "@fxflow/types"

interface PerfDistributionProps {
  data: TVSignalPnLBucket[]
}

export function PerfDistribution({ data }: PerfDistributionProps) {
  const { resolvedTheme } = useTheme()
  const theme = getRechartsTheme(resolvedTheme === "dark")

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <DistributionHeader />
        <p className="text-muted-foreground py-8 text-center text-sm">No distribution data yet</p>
      </div>
    )
  }

  // Find the zero-crossing index for the reference line
  const zeroIndex = data.findIndex((b) => b.min >= 0)
  const zeroLabel = zeroIndex >= 0 ? data[zeroIndex]!.label : undefined

  return (
    <div className="bg-card rounded-xl border p-4">
      <DistributionHeader />
      <div className="mt-3 h-52" role="img" aria-label="P&L distribution histogram">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: theme.axis }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: theme.axis }}
              tickLine={false}
              axisLine={false}
            />
            {zeroLabel && (
              <ReferenceLine x={zeroLabel} stroke={theme.neutral} strokeDasharray="3 3" />
            )}
            <Tooltip
              content={<CustomTooltip theme={theme} data={data} />}
              cursor={{ fill: theme.grid }}
            />
            <Bar
              dataKey="count"
              radius={[2, 2, 0, 0]}
              isAnimationActive={true}
              animationDuration={600}
            >
              {data.map((bucket, i) => (
                <Cell key={i} fill={bucket.min >= 0 ? theme.profit : theme.loss} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: TVSignalPnLBucket }>
  theme: ReturnType<typeof getRechartsTheme>
  data: TVSignalPnLBucket[]
}

function CustomTooltip({ active, payload, theme }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null
  const bucket = payload[0].payload

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        backgroundColor: theme.tooltip.bg,
        borderColor: theme.tooltip.border,
        color: theme.tooltip.text,
      }}
    >
      <p className="font-medium">
        ${bucket.min.toFixed(0)} to ${bucket.max.toFixed(0)}
      </p>
      <p className="text-muted-foreground mt-0.5">
        <span className="font-mono font-semibold tabular-nums">{bucket.count}</span>{" "}
        {bucket.count === 1 ? "trade" : "trades"}
      </p>
    </div>
  )
}

function DistributionHeader() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
      <BarChart3 className="size-3" />
      P&L Distribution
    </div>
  )
}
