"use client"

import type { TradeFinderScoreBreakdown } from "@fxflow/types"
import type { OddsEnhancerScore } from "@fxflow/types"

interface SetupScoreBreakdownProps {
  scores: TradeFinderScoreBreakdown
}

export function ScoreRow({ label, score }: { label: string; score: OddsEnhancerScore }) {
  const pct = score.max > 0 ? (score.value / score.max) * 100 : 0
  const colorClass =
    pct >= 80
      ? "bg-green-500"
      : pct >= 50
        ? "bg-amber-500"
        : pct > 0
          ? "bg-orange-500"
          : "bg-zinc-400"

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-mono tabular-nums">
        {score.value}/{score.max}
      </span>
    </div>
  )
}

export function SetupScoreBreakdown({ scores }: SetupScoreBreakdownProps) {
  return (
    <div className="space-y-1.5">
      <ScoreRow label="Strength" score={scores.strength} />
      <ScoreRow label="Time" score={scores.time} />
      <ScoreRow label="Freshness" score={scores.freshness} />
      <ScoreRow label="Trend" score={scores.trend} />
      <ScoreRow label="Curve" score={scores.curve} />
      <ScoreRow label="Profit Zone" score={scores.profitZone} />
      <ScoreRow label="Commodity" score={scores.commodityCorrelation} />
      <div className="flex items-center gap-2 border-t pt-1 text-xs">
        <span className="w-28 shrink-0 font-medium">Total</span>
        <div className="flex-1" />
        <span className="w-10 text-right font-mono font-bold tabular-nums">
          {scores.total}/{scores.maxPossible}
        </span>
      </div>
    </div>
  )
}
