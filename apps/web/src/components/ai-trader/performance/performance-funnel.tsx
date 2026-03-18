"use client"

import type { AiTraderFunnelStats } from "@fxflow/db"
import { cn } from "@/lib/utils"

interface Props {
  funnel: AiTraderFunnelStats
}

interface FunnelStage {
  label: string
  count: number
  color: string
}

export function PerformanceFunnel({ funnel }: Props) {
  const total =
    funnel.detected +
    funnel.suggested +
    funnel.approved +
    funnel.placed +
    funnel.filled +
    funnel.managed +
    funnel.closed +
    funnel.rejected +
    funnel.expired +
    funnel.skipped

  if (total === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">No pipeline data yet.</div>
    )
  }

  // Cumulative funnel: each stage = count that reached that status or beyond
  const scanned = total
  const analyzed = total - funnel.detected
  const approved = funnel.approved + funnel.placed + funnel.filled + funnel.managed + funnel.closed
  const placed = funnel.placed + funnel.filled + funnel.managed + funnel.closed
  const closed = funnel.closed

  const stages: FunnelStage[] = [
    { label: "Scanned", count: scanned, color: "bg-blue-500" },
    { label: "AI Analyzed", count: analyzed, color: "bg-indigo-500" },
    { label: "Approved", count: approved, color: "bg-violet-500" },
    { label: "Placed", count: placed, color: "bg-purple-500" },
    { label: "Closed", count: closed, color: "bg-emerald-500" },
  ]

  const maxCount = Math.max(...stages.map((s) => s.count), 1)

  return (
    <section aria-label="Pipeline funnel">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        Pipeline Funnel
      </h3>
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 8)
          const prevCount = i > 0 ? stages[i - 1]!.count : stage.count
          const convRate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0

          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="text-muted-foreground w-24 shrink-0 text-right text-xs">
                {stage.label}
              </span>
              <div className="flex-1">
                <div
                  className={cn(
                    "flex h-7 items-center rounded px-3 transition-all duration-500",
                    stage.color,
                  )}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="font-mono text-xs font-semibold tabular-nums text-white">
                    {stage.count}
                  </span>
                </div>
              </div>
              {i > 0 && (
                <span className="text-muted-foreground w-12 shrink-0 text-right font-mono text-[10px] tabular-nums">
                  {convRate}%
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-4">
        <FunnelStat label="Rejected" value={funnel.rejected} />
        <FunnelStat label="Expired" value={funnel.expired} />
        <FunnelStat label="Skipped" value={funnel.skipped} />
      </div>
    </section>
  )
}

function FunnelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-muted-foreground text-[10px]">
      <span>{label}: </span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}
