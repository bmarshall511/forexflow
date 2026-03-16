"use client"

import { cn } from "@/lib/utils"
import type { AiTraderScoreBreakdown } from "@fxflow/types"

/** Beginner-friendly labels for each score component */
const SCORE_LABELS: Record<keyof AiTraderScoreBreakdown, string> = {
  technical: "Chart Patterns",
  fundamental: "Economic Data",
  sentiment: "News Mood",
  session: "Trading Hours",
  historical: "Past Results",
  confluence: "Signal Alignment",
}

const SCORE_ORDER: (keyof AiTraderScoreBreakdown)[] = [
  "technical",
  "confluence",
  "fundamental",
  "sentiment",
  "session",
  "historical",
]

interface ScoreBreakdownProps {
  scores: AiTraderScoreBreakdown
  className?: string
}

export function ScoreBreakdown({ scores, className }: ScoreBreakdownProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {SCORE_ORDER.map((key) => {
        const value = scores[key] ?? 0
        const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-400"
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-muted-foreground w-28 shrink-0 text-[10px]">
              {SCORE_LABELS[key]}
            </span>
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full transition-all", color)}
                style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-[10px] font-medium tabular-nums">
              {value}
            </span>
          </div>
        )
      })}
    </div>
  )
}
