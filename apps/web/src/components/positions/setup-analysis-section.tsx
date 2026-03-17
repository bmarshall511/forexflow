"use client"

import { useState, useMemo } from "react"
import type { TradeFinderSetupData } from "@fxflow/types"
import { TIMEFRAME_SET_MAP } from "@fxflow/types"
import { formatRelativeTime } from "@fxflow/shared"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import { SetupScoreBreakdown } from "@/components/trade-finder/setup-score-breakdown"
import { ScoreGauge } from "./score-gauge"
import { cn } from "@/lib/utils"
import { Search, TrendingUp, TrendingDown, Minus, ChevronDown, ExternalLink } from "lucide-react"
import Link from "next/link"

interface SetupAnalysisSectionProps {
  setup: TradeFinderSetupData
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FORMATION_LABELS: Record<string, string> = {
  DBR: "Drop-Base-Rally",
  RBR: "Rally-Base-Rally",
  RBD: "Rally-Base-Drop",
  DBD: "Drop-Base-Drop",
}

const CURVE_LABELS: Record<string, string> = {
  low: "low zone (bullish)",
  below: "below the curve (bullish)",
  high: "high zone (bearish)",
  above: "above the curve (bearish)",
  middle: "middle zone (neutral)",
  none: "no curve position",
}

function trendIcon(dir: string | null) {
  if (dir === "up") return <TrendingUp className="inline size-3 text-green-500" />
  if (dir === "down") return <TrendingDown className="inline size-3 text-red-500" />
  return <Minus className="text-muted-foreground inline size-3" />
}

function trendLabel(dir: string | null, status: string | undefined) {
  const d = dir === "up" ? "uptrend" : dir === "down" ? "downtrend" : "range/sideways"
  const s = status === "confirmed" ? "confirmed" : status === "forming" ? "forming" : ""
  return s ? `${s} ${d}` : d
}

function curveIcon(pos: string | undefined) {
  if (pos === "low" || pos === "below")
    return <TrendingUp className="inline size-3 text-green-500" />
  if (pos === "high" || pos === "above")
    return <TrendingDown className="inline size-3 text-red-500" />
  return <Minus className="inline size-3 text-amber-500" />
}

function durationBetween(a: string, b: string): string {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (ms < 0) return "—"
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h`
}

// ─── Trade Thesis ───────────────────────────────────────────────────────────

function TradeThesis({ setup }: { setup: TradeFinderSetupData }) {
  const { zone, scores, trendData, curveData, direction, timeframeSet } = setup
  const tfSet = TIMEFRAME_SET_MAP[timeframeSet]

  const parts: string[] = []

  // Zone description
  const formationName = FORMATION_LABELS[zone.formation] ?? zone.formation
  const zoneType = zone.type === "demand" ? "demand" : "supply"
  parts.push(
    `Detected a ${formationName} ${zoneType} zone on ${tfSet.ltf} scoring ${scores.total}/${scores.maxPossible}.`,
  )

  // Trend
  if (trendData) {
    const tDir =
      trendData.direction === "up" ? "up" : trendData.direction === "down" ? "down" : "ranging"
    const aligned =
      (direction === "long" && trendData.direction === "up") ||
      (direction === "short" && trendData.direction === "down")
    parts.push(
      `The ${tfSet.mtf} trend was ${trendData.status} ${tDir}${aligned ? " — aligned with the trade direction" : ""}.`,
    )
  }

  // Curve
  if (curveData) {
    const pos = CURVE_LABELS[curveData.position] ?? curveData.position
    parts.push(`Price was in the ${pos} of the ${tfSet.htf} curve.`)
  }

  return <p className="text-muted-foreground text-xs leading-relaxed">{parts.join(" ")}</p>
}

// ─── Market Context Grid ────────────────────────────────────────────────────

function MarketContext({ setup }: { setup: TradeFinderSetupData }) {
  const { zone, trendData, curveData, timeframeSet } = setup
  const tfSet = TIMEFRAME_SET_MAP[timeframeSet]

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {/* Zone */}
      <ContextItem
        label="Zone"
        icon={
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              zone.type === "demand" ? "bg-green-500" : "bg-red-500",
            )}
          />
        }
        value={`${zone.formation} ${zone.type} on ${tfSet.ltf}`}
      />
      {/* R:R */}
      <ContextItem
        label="R:R"
        icon={<span className="text-muted-foreground text-[10px]">⚖</span>}
        value={setup.rrRatio}
      />
      {/* Trend */}
      {trendData && (
        <ContextItem
          label="Trend"
          icon={trendIcon(trendData.direction)}
          value={`${trendLabel(trendData.direction, trendData.status)} on ${tfSet.mtf}`}
        />
      )}
      {/* Curve */}
      {curveData && (
        <ContextItem
          label="Curve"
          icon={curveIcon(curveData.position)}
          value={`${curveData.position} on ${tfSet.htf}`}
        />
      )}
    </div>
  )
}

function ContextItem({
  label,
  icon,
  value,
}: {
  label: string
  icon: React.ReactNode
  value: string
}) {
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground capitalize">{value}</span>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SetupAnalysisSection({ setup }: SetupAnalysisSectionProps) {
  const [showScores, setShowScores] = useState(false)

  const metadata = useMemo(() => {
    const items: { label: string; value: string }[] = [
      { label: "Detected", value: formatRelativeTime(setup.detectedAt) },
      {
        label: "Placed",
        value: setup.placedAt
          ? `${formatRelativeTime(setup.placedAt)} (${setup.autoPlaced ? "auto" : "manual"})`
          : "—",
      },
    ]

    if (setup.placedAt && setup.detectedAt) {
      items.push({
        label: "Time to Place",
        value: durationBetween(setup.detectedAt, setup.placedAt),
      })
    }

    items.push(
      { label: "Timeframe Set", value: setup.timeframeSet },
      { label: "Risk", value: `${setup.riskPips.toFixed(1)} pips` },
      { label: "Reward", value: `${setup.rewardPips.toFixed(1)} pips` },
      { label: "Position Size", value: setup.positionSize.toLocaleString() + " units" },
    )

    return items
  }, [setup])

  return (
    <SectionCard
      icon={Search}
      title="Setup Analysis"
      helper="The Trade Finder analysis snapshot from when this setup was detected."
    >
      <div className="space-y-3">
        {/* Header: gauge + thesis + link */}
        <div className="flex gap-3">
          <ScoreGauge score={setup.scores.total} max={setup.scores.maxPossible} />
          <div className="min-w-0 flex-1 space-y-1">
            <TradeThesis setup={setup} />
            <Link
              href="/trade-finder"
              className="text-primary inline-flex items-center gap-1 text-[10px] font-medium hover:underline"
            >
              View Trade Finder
              <ExternalLink className="size-2.5" />
            </Link>
          </div>
        </div>

        {/* Market context */}
        <MarketContext setup={setup} />

        {/* Metadata grid */}
        <div>
          {metadata.map((m) => (
            <DetailRow key={m.label} label={m.label} value={m.value} />
          ))}
        </div>

        {/* Score breakdown (collapsible) */}
        <button
          type="button"
          onClick={() => setShowScores((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-[11px] font-medium transition-colors"
          aria-expanded={showScores}
        >
          <ChevronDown className={cn("size-3 transition-transform", showScores && "rotate-180")} />
          Score Breakdown
        </button>
        {showScores && <SetupScoreBreakdown scores={setup.scores} />}
      </div>
    </SectionCard>
  )
}
