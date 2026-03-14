"use client"

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
import { Clock } from "lucide-react"
import { useTheme } from "next-themes"
import { getRechartsTheme } from "@/lib/chart-theme"
import type { SessionPerformance } from "@fxflow/types"

interface SessionPerformanceChartProps {
  data: SessionPerformance[]
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: SessionPerformance }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="bg-popover rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{d.session}</p>
      <p>
        P&L:{" "}
        <span className={d.totalPL >= 0 ? "text-green-500" : "text-red-500"}>
          ${d.totalPL.toFixed(2)}
        </span>
      </p>
      <p>Win Rate: {d.winRate.toFixed(1)}%</p>
      <p>Trades: {d.trades}</p>
      <p>Profit Factor: {d.profitFactor >= 999999 ? "\u221E" : d.profitFactor.toFixed(2)}</p>
    </div>
  )
}

export function PerfSessionPerformance({ data }: SessionPerformanceChartProps) {
  const { resolvedTheme } = useTheme()
  const theme = getRechartsTheme(resolvedTheme === "dark")

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
          <Clock className="size-3" aria-hidden="true" />
          Session Performance
        </div>
        <p className="text-muted-foreground py-8 text-center text-sm">
          No session data available yet
        </p>
      </div>
    )
  }

  const best = data.reduce((a, b) => (b.totalPL > a.totalPL ? b : a))

  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
        <Clock className="size-3" aria-hidden="true" />
        Session Performance
      </div>

      <div className="h-48" role="img" aria-label="Bar chart of P&L by trading session">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="session"
              tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.grid }} />
            <Bar dataKey="totalPL" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry) => {
                const sessionIndex =
                  entry.session.toLowerCase() === "asian"
                    ? 0
                    : entry.session.toLowerCase() === "london"
                      ? 1
                      : 2
                return <Cell key={entry.session} fill={theme.sessionColors[sessionIndex]} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
          Best: {best.session} ({best.winRate.toFixed(0)}% WR)
        </span>
      </div>
    </div>
  )
}
