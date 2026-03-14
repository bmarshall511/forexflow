"use client"

import { useMemo } from "react"
import { useTheme } from "next-themes"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Radio } from "lucide-react"
import { getRechartsTheme } from "@/lib/chart-theme"
import type { TVSignalPairStats } from "@fxflow/types"

interface PerfSignalsByPairProps {
  data: TVSignalPairStats[]
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: TVSignalPairStats }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  const execRate = d.total > 0 ? Math.round((d.executed / d.total) * 100) : 0

  return (
    <div className="bg-popover border-border rounded-lg border p-2 text-xs shadow-lg">
      <p className="font-medium">{d.instrument.replace("_", "/")}</p>
      <p className="text-muted-foreground mt-1">
        {d.total} signals · {execRate}% executed
      </p>
      <div className="mt-1 space-y-0.5">
        <p>
          <span className="text-green-500">{d.buys} buy</span>
          {" · "}
          <span className="text-red-500">{d.sells} sell</span>
        </p>
        {d.rejected > 0 && <p className="text-amber-500">{d.rejected} rejected</p>}
        {d.failed > 0 && <p className="text-red-500">{d.failed} failed</p>}
      </div>
    </div>
  )
}

export function PerfSignalsByPair({ data }: PerfSignalsByPairProps) {
  const { resolvedTheme } = useTheme()
  const theme = useMemo(() => getRechartsTheme(resolvedTheme === "dark"), [resolvedTheme])

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        name: d.instrument.replace("_", "/"),
      })),
    [data],
  )

  const chartHeight = Math.max(chartData.length * 36, 120)

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <SignalsByPairHeader />
        <p className="text-muted-foreground py-8 text-center text-sm">No signal data by pair yet</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border p-4">
      <SignalsByPairHeader />
      <div className="mt-3" role="img" aria-label="Signal volume by currency pair">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} horizontal={false} />
            <YAxis
              type="category"
              dataKey="name"
              stroke={theme.axis}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <XAxis
              type="number"
              stroke={theme.axis}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.grid }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Bar
              dataKey="buys"
              name="Buy"
              stackId="signals"
              fill={theme.profit}
              radius={[0, 0, 0, 0]}
              maxBarSize={20}
            />
            <Bar
              dataKey="sells"
              name="Sell"
              stackId="signals"
              fill={theme.loss}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SignalsByPairHeader() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
      <Radio className="size-3" />
      Signals by Pair
    </div>
  )
}
