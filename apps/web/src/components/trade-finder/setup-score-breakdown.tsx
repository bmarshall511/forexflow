"use client"

import type { TradeFinderScoreBreakdown, OddsEnhancerScore } from "@fxflow/types"

/** Plain English names and descriptions for each score dimension */
const SCORE_INFO: Record<string, { name: string; what: string }> = {
  strength: {
    name: "How strong the zone is",
    what: "How powerfully price moved away from this zone when it first formed. Stronger moves = more unfilled orders waiting.",
  },
  time: {
    name: "How quickly it formed",
    what: "Zones that formed fast (1-3 candles) are stronger than ones that took a long time. Quick formation means big traders moved decisively.",
  },
  freshness: {
    name: "Never been tested",
    what: "Has price come back to this zone before? First-time visits have the most unfilled orders and highest chance of a reaction.",
  },
  trend: {
    name: "Going with the flow",
    what: "Is this trade in the same direction the market is already moving? Trading with the trend is much safer than against it.",
  },
  curve: {
    name: "Good position on the big picture",
    what: "Is the price in a favorable area of the bigger timeframe? Buying low and selling high on the big picture improves odds.",
  },
  profitZone: {
    name: "Room to reach the target",
    what: "How much space there is between entry and the profit target, compared to the risk. More room = better trade.",
  },
  commodityCorrelation: {
    name: "Related markets agree",
    what: "Do related markets (like gold for AUD) support this trade direction? When related markets agree, the trade is stronger.",
  },
  session: {
    name: "Right time of day",
    what: "Is this pair being traded during its busiest hours? Each currency pair has times when it moves most and spreads are tightest.",
  },
  keyLevel: {
    name: "Near an important price level",
    what: "Is the entry near a round number (like 1.3000) or yesterday's high/low? These levels often cause price reactions.",
  },
  volatilityRegime: {
    name: "Market conditions",
    what: "Is the market behaving normally? Zone trading works best in calm or trending markets, not during wild swings.",
  },
  htfConfluence: {
    name: "Backed by a bigger zone",
    what: "Does a zone on a higher timeframe overlap this one? When zones from multiple timeframes stack up, the trade is much stronger.",
  },
}

function ScoreRow({ id, score }: { id: string; score: OddsEnhancerScore }) {
  const info = SCORE_INFO[id]
  const pct = score.max > 0 ? (score.value / score.max) * 100 : 0
  const colorClass =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : pct > 0 ? "bg-orange-500" : "bg-zinc-400"
  const label = score.label === "N/A" ? "Not applicable" : score.label

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{info?.name ?? id}</span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className={pct >= 80 ? "text-green-500" : pct >= 50 ? "text-amber-500" : pct > 0 ? "text-orange-500" : "text-muted-foreground"}>
            {label}
          </span>
          <span className="text-muted-foreground font-mono tabular-nums">{score.value}/{score.max}</span>
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      {/* Explanation — always show why this score was given */}
      <p className="text-muted-foreground text-[10px] leading-snug">
        {score.explanation}
      </p>
    </div>
  )
}

interface SetupScoreBreakdownProps {
  scores: TradeFinderScoreBreakdown
}

export function SetupScoreBreakdown({ scores }: SetupScoreBreakdownProps) {
  const rows: [string, OddsEnhancerScore | undefined][] = [
    ["strength", scores.strength],
    ["time", scores.time],
    ["freshness", scores.freshness],
    ["trend", scores.trend],
    ["curve", scores.curve],
    ["profitZone", scores.profitZone],
    ["commodityCorrelation", scores.commodityCorrelation],
    ["session", scores.session],
    ["keyLevel", scores.keyLevel],
    ["volatilityRegime", scores.volatilityRegime],
    ["htfConfluence", scores.htfConfluence],
  ]

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-[10px] leading-snug">
        Each trade idea is scored on {rows.filter(([, s]) => s).length} factors. Higher scores mean
        more things are working in your favor. Tap any factor to learn what it means.
      </p>

      {rows.map(([id, score]) =>
        score ? <ScoreRow key={id} id={id} score={score} /> : null,
      )}

      {/* Total */}
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-sm font-semibold">Overall Score</span>
        <span className="font-mono text-sm font-bold tabular-nums">
          {scores.total} / {scores.maxPossible}
        </span>
      </div>
    </div>
  )
}

export { ScoreRow }
