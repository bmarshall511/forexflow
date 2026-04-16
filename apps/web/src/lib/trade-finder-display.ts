/**
 * Shared display helpers for Trade Finder trade context.
 * Used by both the compact `SourceContextPanel` and the full `SetupAnalysisSection`.
 */
import type {
  TradeFinderManagementAction,
  TradeFinderTimeframeSet,
  TrendData,
  CurveData,
  ZoneData,
  TradeDirection,
} from "@fxflow/types"
import { TIMEFRAME_SET_MAP } from "@fxflow/types"

// ─── Zone formation labels ─────────────────────────────────────────────────

export const FORMATION_LABELS: Record<string, string> = {
  DBR: "Drop-Base-Rally",
  RBR: "Rally-Base-Rally",
  RBD: "Rally-Base-Drop",
  DBD: "Drop-Base-Drop",
}

// ─── Management phase derivation ───────────────────────────────────────────

export type ManagementPhase = {
  label: string
  color: string
  bg: string
  border: string
}

const PHASES: Record<string, ManagementPhase> = {
  entry: {
    label: "Entry",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  breakeven: {
    label: "Breakeven",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  trailing: {
    label: "Trailing",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  partial: {
    label: "Partial Exit",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  time_exit: {
    label: "Time Exit",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
}

/**
 * Derive the current management phase from flags + log entries.
 * Priority: time_exit > partial > trailing > breakeven > entry.
 */
export function deriveManagementPhase(
  breakevenMoved: boolean,
  partialTaken: boolean,
  log: TradeFinderManagementAction[],
): ManagementPhase {
  if (log.some((e) => e.action === "time_exit")) return PHASES.time_exit!
  if (partialTaken) return PHASES.partial!
  if (log.some((e) => e.action === "trailing_update")) return PHASES.trailing!
  if (breakevenMoved) return PHASES.breakeven!
  return PHASES.entry!
}

// ─── Estimated hold time ───────────────────────────────────────────────────

export const TF_TIME_ESTIMATES: Record<TradeFinderTimeframeSet, string> = {
  hourly: "~30 min – 2 hrs",
  daily: "~1 – 8 hrs",
  weekly: "~4 – 48 hrs",
  monthly: "~1 – 5 days",
}

export function getEstimatedHoldTime(timeframeSet: string): string {
  return TF_TIME_ESTIMATES[timeframeSet as TradeFinderTimeframeSet] ?? "—"
}

// ─── Management action labels ──────────────────────────────────────────────

export const TF_MGMT_ACTION_LABELS: Record<TradeFinderManagementAction["action"], string> = {
  breakeven: "Breakeven",
  trailing_update: "Trailing Stop",
  partial_close: "Partial Close",
  thirds_partial: "2nd Partial",
  time_exit: "Time Exit",
  ai_handoff: "AI Managing",
  adaptive_partial: "Adaptive Partial",
}

// ─── Confidence framing ────────────────────────────────────────────────────

export function toConfidencePct(scoreTotal: number, maxPossible: number): number {
  return maxPossible > 0 ? Math.round((scoreTotal / maxPossible) * 100) : 0
}

export function getConfidenceColor(pct: number): string {
  if (pct >= 80) return "border-green-500/30 bg-green-500/10 text-green-500"
  if (pct >= 60) return "border-amber-500/30 bg-amber-500/10 text-amber-500"
  return "border-orange-500/30 bg-orange-500/10 text-orange-500"
}

// ─── Trade thesis generation (condensed, 1 sentence) ───────────────────────

export function buildThesis(input: {
  zone: ZoneData
  timeframeSet: TradeFinderTimeframeSet
  direction: TradeDirection
  trendData: TrendData | null
  curveData: CurveData | null
}): string {
  const { zone, timeframeSet, direction, trendData, curveData } = input
  const tfSet = TIMEFRAME_SET_MAP[timeframeSet]
  const formationName = FORMATION_LABELS[zone.formation] ?? zone.formation
  const zoneType = zone.type === "demand" ? "demand" : "supply"

  const parts = [`${formationName} ${zoneType} zone on ${tfSet.ltf}`]

  if (trendData) {
    const aligned =
      (direction === "long" && trendData.direction === "up") ||
      (direction === "short" && trendData.direction === "down")
    if (aligned) {
      parts.push(
        `aligned with ${tfSet.mtf} ${trendData.direction === "up" ? "uptrend" : "downtrend"}`,
      )
    } else if (trendData.direction === "up" || trendData.direction === "down") {
      parts.push(`counter-${tfSet.mtf} trend`)
    }
  }

  if (curveData && (curveData.position === "low" || curveData.position === "below")) {
    parts.push("in favorable curve zone")
  } else if (curveData && (curveData.position === "high" || curveData.position === "above")) {
    parts.push("in unfavorable curve zone")
  }

  return parts.join(", ") + "."
}
