"use client"

import { useMemo } from "react"
import type { SessionPerformance } from "@fxflow/types"
import { cn } from "@/lib/utils"
import { Star } from "lucide-react"

interface Props {
  data: SessionPerformance[]
}

function fmtPL(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`
}

function plColor(v: number): string {
  if (v > 0) return "text-green-600 dark:text-green-400"
  if (v < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

export function SessionChart({ data }: Props) {
  const maxTrades = useMemo(() => Math.max(...data.map((d) => d.trades), 1), [data])

  const bestSession = useMemo(() => {
    if (data.length === 0) return null
    return data.reduce((best, d) => (d.totalPL > best.totalPL ? d : best), data[0]!)
  }, [data])

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">No session data available</p>
    )
  }

  return (
    <div className="space-y-6" role="region" aria-label="Performance by trading session">
      <p className="text-muted-foreground text-sm">How you performed during each market session</p>

      {/* Best time callout */}
      {bestSession && bestSession.totalPL > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <Star className="size-4 shrink-0 text-green-500" />
          <p className="text-sm">
            <span className="font-semibold">Best time to trade:</span>{" "}
            <span className="text-green-600 dark:text-green-400">{bestSession.session}</span>{" "}
            session with {fmtPL(bestSession.totalPL)} profit across {bestSession.trades} trades
          </p>
        </div>
      )}

      {/* Session bars */}
      <div className="space-y-4">
        {data.map((session) => {
          const barPct = Math.max((session.trades / maxTrades) * 100, 4)
          const isProfit = session.totalPL >= 0
          return (
            <div key={session.session} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{session.session}</span>
                <span className={cn("text-sm font-bold tabular-nums", plColor(session.totalPL))}>
                  {fmtPL(session.totalPL)}
                </span>
              </div>
              <div className="bg-muted/40 relative h-10 overflow-hidden rounded-lg">
                <div
                  className={cn(
                    "h-full rounded-lg transition-all duration-500",
                    isProfit ? "bg-green-500/20" : "bg-red-500/20",
                  )}
                  style={{ width: `${barPct}%` }}
                  role="meter"
                  aria-label={`${session.session}: ${session.trades} trades`}
                  aria-valuenow={session.trades}
                  aria-valuemin={0}
                  aria-valuemax={maxTrades}
                />
                <div className="text-muted-foreground absolute inset-y-0 left-3 flex items-center text-xs">
                  {session.trades} trades / {(session.winRate * 100).toFixed(0)}% win rate
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
