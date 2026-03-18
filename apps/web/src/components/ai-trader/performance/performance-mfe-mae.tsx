"use client"

import { useMemo } from "react"
import type { AiTraderMfeMaePoint } from "@fxflow/db"
import { cn } from "@/lib/utils"

interface Props {
  data: AiTraderMfeMaePoint[]
}

export function PerformanceMfeMae({ data }: Props) {
  const summary = useMemo(() => {
    if (data.length === 0) return null

    const wins = data.filter((d) => d.outcome === "win")
    const losses = data.filter((d) => d.outcome === "loss")

    const avgMfeWins = wins.length > 0 ? wins.reduce((s, d) => s + d.mfe, 0) / wins.length : 0
    const avgMaeLosses =
      losses.length > 0 ? losses.reduce((s, d) => s + Math.abs(d.mae), 0) / losses.length : 0
    const avgMfeAll = data.reduce((s, d) => s + d.mfe, 0) / data.length
    const avgMaeAll = data.reduce((s, d) => s + Math.abs(d.mae), 0) / data.length

    // Wasted MFE: winning trades where MFE was much higher than realized profit
    const wastedMfe = wins.filter((d) => d.mfe > 0 && d.realizedPL > 0 && d.mfe > d.realizedPL * 2)

    return {
      avgMfeWins,
      avgMaeLosses,
      avgMfeAll,
      avgMaeAll,
      wastedMfe: wastedMfe.length,
      wins: wins.length,
      losses: losses.length,
    }
  }, [data])

  if (!summary || data.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No MFE/MAE data yet. Trades need to close first.
      </div>
    )
  }

  return (
    <section aria-label="Maximum Favorable and Adverse Excursion analysis">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        MFE / MAE Analysis
      </h3>
      <p className="text-muted-foreground mb-3 text-xs">
        Shows how far trades moved in your favor (MFE) and against you (MAE) before closing.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Avg MFE (wins)" value={`${summary.avgMfeWins.toFixed(1)} pips`} positive />
        <StatCard
          label="Avg MAE (losses)"
          value={`${summary.avgMaeLosses.toFixed(1)} pips`}
          positive={false}
        />
        <StatCard label="Avg MFE (all)" value={`${summary.avgMfeAll.toFixed(1)} pips`} />
        <StatCard label="Avg MAE (all)" value={`${summary.avgMaeAll.toFixed(1)} pips`} />
      </div>

      {/* Per-trade MFE/MAE bars */}
      {data.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            Per-Trade Excursion (green = MFE, red = MAE)
          </div>
          {data.map((d, i) => {
            const maxVal = Math.max(Math.abs(d.mfe), Math.abs(d.mae), 1)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-16 truncate text-right tabular-nums">
                  {d.instrument.replace("_", "/")}
                </span>
                <div className="flex flex-1 items-center gap-0.5">
                  {/* MAE bar (left, red) */}
                  <div className="flex flex-1 justify-end">
                    <div
                      className="h-3 rounded-l bg-red-500/60"
                      style={{ width: `${(Math.abs(d.mae) / maxVal) * 100}%` }}
                    />
                  </div>
                  <div className="bg-border h-3 w-px" />
                  {/* MFE bar (right, green) */}
                  <div className="flex-1">
                    <div
                      className="h-3 rounded-r bg-emerald-500/60"
                      style={{ width: `${(d.mfe / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "w-8 text-right tabular-nums",
                    d.outcome === "win" ? "text-emerald-500" : "text-red-500",
                  )}
                >
                  {d.outcome === "win" ? "W" : "L"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function StatCard({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div className="bg-card rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          positive === true && "text-emerald-500",
          positive === false && "text-red-500",
        )}
      >
        {value}
      </div>
    </div>
  )
}
