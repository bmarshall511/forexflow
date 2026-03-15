"use client"

import { useMemo } from "react"
import type { MfeMaeEntry } from "@fxflow/types"
import { DataTile } from "@/components/ui/data-tile"
import { ArrowUpRight, ArrowDownRight, Scale, BarChart3 } from "lucide-react"

interface Props {
  data: MfeMaeEntry[]
}

function BarComparison({
  label,
  green,
  red,
  maxVal,
}: {
  label: string
  green: number
  red: number
  maxVal: number
}) {
  const greenPct = maxVal > 0 ? (green / maxVal) * 100 : 0
  const redPct = maxVal > 0 ? (red / maxVal) * 100 : 0

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24 text-[11px]">In your favor</span>
          <div className="bg-muted/30 h-6 flex-1 overflow-hidden rounded">
            <div
              className="flex h-full items-center rounded bg-green-500/25 px-2 text-[11px] font-semibold tabular-nums text-green-600 dark:text-green-400"
              style={{ width: `${Math.max(greenPct, 8)}%` }}
            >
              {green.toFixed(1)} pips
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24 text-[11px]">Against you</span>
          <div className="bg-muted/30 h-6 flex-1 overflow-hidden rounded">
            <div
              className="flex h-full items-center rounded bg-red-500/25 px-2 text-[11px] font-semibold tabular-nums text-red-600 dark:text-red-400"
              style={{ width: `${Math.max(redPct, 8)}%` }}
            >
              {Math.abs(red).toFixed(1)} pips
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EdgeAnalysis({ data }: Props) {
  const stats = useMemo(() => {
    const withMfe = data.filter((d) => d.mfePips !== null)
    const withMae = data.filter((d) => d.maePips !== null)
    const avgMfe =
      withMfe.length > 0 ? withMfe.reduce((s, d) => s + d.mfePips!, 0) / withMfe.length : 0
    const avgMae =
      withMae.length > 0 ? withMae.reduce((s, d) => s + d.maePips!, 0) / withMae.length : 0
    const edgeRatio = avgMae !== 0 ? avgMfe / Math.abs(avgMae) : 0
    const wins = data.filter((d) => d.outcome === "win")
    const losses = data.filter((d) => d.outcome === "loss")
    const avgWinMfe =
      wins.length > 0 ? wins.reduce((s, d) => s + (d.mfePips ?? 0), 0) / wins.length : 0
    const avgWinMae =
      wins.length > 0 ? wins.reduce((s, d) => s + (d.maePips ?? 0), 0) / wins.length : 0
    const avgLossMfe =
      losses.length > 0 ? losses.reduce((s, d) => s + (d.mfePips ?? 0), 0) / losses.length : 0
    const avgLossMae =
      losses.length > 0 ? losses.reduce((s, d) => s + (d.maePips ?? 0), 0) / losses.length : 0
    return {
      avgMfe,
      avgMae,
      edgeRatio,
      tracked: withMfe.length,
      total: data.length,
      avgWinMfe,
      avgWinMae,
      avgLossMfe,
      avgLossMae,
    }
  }, [data])

  if (data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No edge data available</p>
  }

  const barMax = Math.max(
    stats.avgMfe,
    Math.abs(stats.avgMae),
    stats.avgWinMfe,
    Math.abs(stats.avgLossMae),
    1,
  )

  return (
    <div className="space-y-6" role="region" aria-label="Trade edge analysis">
      <p className="text-muted-foreground text-sm">
        How much your trades moved in your favor vs. against you before closing
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <DataTile
          label="Avg. In Your Favor"
          value={`${stats.avgMfe.toFixed(1)} pips`}
          icon={<ArrowUpRight className="size-3.5" />}
          variant="positive"
        />
        <DataTile
          label="Avg. Against You"
          value={`${Math.abs(stats.avgMae).toFixed(1)} pips`}
          icon={<ArrowDownRight className="size-3.5" />}
          variant="negative"
        />
        <DataTile
          label="Edge Ratio"
          value={stats.edgeRatio > 0 ? `${stats.edgeRatio.toFixed(2)}x` : "N/A"}
          icon={<Scale className="size-3.5" />}
          variant={stats.edgeRatio > 1 ? "positive" : stats.edgeRatio > 0 ? "negative" : "muted"}
          subtitle={
            stats.edgeRatio > 1
              ? "Good — more reward than risk"
              : "Below 1x — more risk than reward"
          }
        />
        <DataTile
          label="Trades Tracked"
          value={`${stats.tracked} / ${stats.total}`}
          icon={<BarChart3 className="size-3.5" />}
        />
      </div>

      {/* Bar comparisons */}
      <div className="border-border/50 space-y-6 rounded-xl border p-4">
        <BarComparison label="All Trades" green={stats.avgMfe} red={stats.avgMae} maxVal={barMax} />
        <BarComparison
          label="Winning Trades"
          green={stats.avgWinMfe}
          red={stats.avgWinMae}
          maxVal={barMax}
        />
        <BarComparison
          label="Losing Trades"
          green={stats.avgLossMfe}
          red={stats.avgLossMae}
          maxVal={barMax}
        />
      </div>
    </div>
  )
}
