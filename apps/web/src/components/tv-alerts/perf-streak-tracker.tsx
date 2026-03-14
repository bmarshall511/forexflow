"use client"

import { useMemo } from "react"
import { Flame, Snowflake, Trophy, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PerformanceSummary, EquityCurvePoint } from "@fxflow/types"

interface PerfStreakTrackerProps {
  summary: PerformanceSummary | null
  equityCurve: EquityCurvePoint[]
}

export function PerfStreakTracker({ summary, equityCurve }: PerfStreakTrackerProps) {
  const dots = useMemo(() => {
    if (equityCurve.length < 2) return []
    const recent = equityCurve.slice(-21)
    const result: Array<"win" | "loss" | "flat"> = []
    for (let i = 1; i < recent.length; i++) {
      const diff = recent[i]!.cumulativePL - recent[i - 1]!.cumulativePL
      result.push(diff > 0.001 ? "win" : diff < -0.001 ? "loss" : "flat")
    }
    return result.slice(-20)
  }, [equityCurve])

  if (!summary) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <StreakHeader />
        <p className="text-muted-foreground py-8 text-center text-sm">No streak data yet</p>
      </div>
    )
  }

  const { currentStreak, longestWinStreak, longestLossStreak } = summary
  const isWinStreak = currentStreak.type === "win"

  return (
    <div className="bg-card rounded-xl border p-4">
      <StreakHeader />

      {/* Current streak */}
      <div className="mt-3 flex items-center gap-2">
        {isWinStreak ? (
          <Flame className="size-5 text-orange-500" aria-hidden="true" />
        ) : (
          <Snowflake className="size-5 text-blue-400" aria-hidden="true" />
        )}
        <span
          className={cn(
            "font-mono text-2xl font-bold tabular-nums",
            isWinStreak ? "text-green-500" : "text-red-500",
          )}
        >
          {currentStreak.count}
        </span>
        <span className="text-muted-foreground text-sm">
          {isWinStreak ? "Win Streak" : "Loss Streak"}
        </span>
      </div>

      {/* Records */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="space-y-0.5">
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Trophy className="size-3" aria-hidden="true" />
            Best Win Streak
          </div>
          <p className="font-mono text-sm font-semibold tabular-nums text-green-500">
            {longestWinStreak}
          </p>
        </div>
        <div className="space-y-0.5">
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Worst Loss Streak
          </div>
          <p className="font-mono text-sm font-semibold tabular-nums text-red-500">
            {longestLossStreak}
          </p>
        </div>
      </div>

      {/* Last 20 dots */}
      {dots.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground mb-1.5 text-[10px] uppercase tracking-wider">
            Recent Days
          </p>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Recent daily outcomes">
            {dots.map((dot, i) => (
              <span
                key={i}
                role="listitem"
                aria-label={
                  dot === "win" ? "Positive day" : dot === "loss" ? "Negative day" : "Flat day"
                }
                className={cn(
                  "size-2.5 rounded-full",
                  dot === "win" && "bg-green-500",
                  dot === "loss" && "bg-red-500",
                  dot === "flat" && "bg-gray-400",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StreakHeader() {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
      <Flame className="size-3" />
      Streaks
    </div>
  )
}
