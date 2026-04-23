"use client"

import { useMemo } from "react"
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipProps,
} from "recharts"
import type { MfeMaeEntry } from "@fxflow/types"
import { formatInstrument } from "@fxflow/shared"
import { cn } from "@/lib/utils"

/**
 * MFE vs. MAE scatter — Y = pips favorable (MFE), X = pips adverse (|MAE|).
 * Points colored by outcome. "Left money on the table" = top-right quadrant
 * (ran deep in your favor + deep against you before closing).
 *
 * Only renders entries that have both mfe + mae; skips cancelled orders.
 */
interface MfeMaeScatterProps {
  data: MfeMaeEntry[]
  height?: number
  className?: string
}

interface Row {
  x: number // |MAE| pips
  y: number // MFE pips
  outcome: "win" | "loss" | "breakeven"
  instrument: string
  realizedPL: number
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as Row | undefined
  if (!row) return null
  return (
    <div className="bg-popover border-border rounded-md border p-2 text-xs shadow-md">
      <p className="font-medium">{formatInstrument(row.instrument)}</p>
      <p className="text-muted-foreground tabular-nums">
        MFE {row.y.toFixed(1)}p · MAE -{row.x.toFixed(1)}p
      </p>
      <p
        className={cn(
          "font-mono font-semibold tabular-nums",
          row.realizedPL > 0
            ? "text-status-connected"
            : row.realizedPL < 0
              ? "text-status-disconnected"
              : "text-muted-foreground",
        )}
        data-private="true"
      >
        {row.realizedPL >= 0 ? "+" : ""}
        {row.realizedPL.toFixed(2)}
      </p>
    </div>
  )
}

export function MfeMaeScatter({ data, height = 240, className }: MfeMaeScatterProps) {
  const { wins, losses, breakevens } = useMemo(() => {
    const wins: Row[] = []
    const losses: Row[] = []
    const breakevens: Row[] = []
    for (const e of data) {
      if (e.mfePips == null || e.maePips == null) continue
      const row: Row = {
        x: Math.abs(e.maePips),
        y: e.mfePips,
        outcome: e.outcome as Row["outcome"],
        instrument: e.instrument,
        realizedPL: e.realizedPL,
      }
      if (row.outcome === "win") wins.push(row)
      else if (row.outcome === "loss") losses.push(row)
      else breakevens.push(row)
    }
    return { wins, losses, breakevens }
  }, [data])

  const total = wins.length + losses.length + breakevens.length

  if (total === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed text-xs",
          className,
        )}
        style={{ height }}
      >
        No MFE/MAE data yet — trades need to close with tracked excursion to appear here
      </div>
    )
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 12, bottom: 28, left: 12 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.1} />
          <XAxis
            type="number"
            dataKey="x"
            name="MAE"
            unit="p"
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
            label={{
              value: "Adverse pips (MAE)",
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 10, fill: "currentColor", opacity: 0.6 },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="MFE"
            unit="p"
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
            label={{
              value: "Favorable pips (MFE)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "currentColor", opacity: 0.6 },
            }}
          />
          <ZAxis type="number" range={[30, 30]} />
          <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter
            name="Wins"
            data={wins}
            fill="var(--color-status-connected, #22c55e)"
            fillOpacity={0.75}
          />
          <Scatter
            name="Losses"
            data={losses}
            fill="var(--color-status-disconnected, #ef4444)"
            fillOpacity={0.75}
          />
          <Scatter
            name="Breakevens"
            data={breakevens}
            fill="var(--color-muted-foreground, #888)"
            fillOpacity={0.6}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
