import type { TradeFinderSetupData } from "@fxflow/types"
import { getPipSize } from "@fxflow/shared"

// ─── Exported types & constants ───

export interface AutoTradeConfig {
  autoTradeEnabled: boolean
  autoTradeMinScore: number
  autoTradeMinRR: number
}

export const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  active: { className: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Watching" },
  approaching: {
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
    label: "Getting close",
  },
  placed: { className: "bg-teal-500/10 text-teal-500 border-teal-500/20", label: "Order placed" },
  filled: { className: "bg-green-500/10 text-green-500 border-green-500/20", label: "Trade open" },
  invalidated: { className: "bg-red-500/10 text-red-500 border-red-500/20", label: "No longer valid" },
  expired: { className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", label: "Expired" },
}

export const TF_LABELS: Record<string, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}

export function fmtDollar(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${amount.toFixed(2)}`
}

export function computeDollarAmount(
  positionSize: number,
  pips: number,
  instrument: string,
): number {
  const pipSize = getPipSize(instrument)
  return positionSize * pips * pipSize
}

// ─── Auto-trade status logic ───

export type AutoTradeStatus =
  | { type: "eligible"; reason?: string }
  | { type: "queued"; position: number | null; reason: string }
  | { type: "blocked"; reason: string }
  | null

const CAP_KEYWORDS = ["concurrent", "risk"]

function isCappedReason(reason: string): boolean {
  const lower = reason.toLowerCase()
  return CAP_KEYWORDS.some((kw) => lower.includes(kw))
}

export function getAutoTradeStatus(
  setup: TradeFinderSetupData,
  config: AutoTradeConfig,
  liveDistancePips?: number,
): AutoTradeStatus {
  if (!config.autoTradeEnabled) return null
  if (setup.status === "placed" || setup.status === "filled") return null
  if (setup.autoPlaced) return null
  if (setup.status !== "active" && setup.status !== "approaching") return null

  if (setup.scores.total < config.autoTradeMinScore) {
    return {
      type: "blocked",
      reason: `Quality too low — scored ${setup.scores.total}, needs at least ${config.autoTradeMinScore}`,
    }
  }

  const rrNum = parseFloat(setup.rrRatio)
  if (!isNaN(rrNum) && rrNum < config.autoTradeMinRR) {
    return { type: "blocked", reason: `Profit target too small — needs at least ${config.autoTradeMinRR}:1` }
  }

  if (setup.lastSkipReason) {
    if (isCappedReason(setup.lastSkipReason)) {
      return { type: "queued", position: setup.queuePosition, reason: setup.lastSkipReason }
    }
    return { type: "blocked", reason: setup.lastSkipReason }
  }

  if (setup.queuePosition != null) {
    return { type: "queued", position: setup.queuePosition, reason: "In line — waiting for a trade slot to open up" }
  }

  const pair = setup.instrument.replace("_", "/")
  const dir = setup.direction === "long" ? "go up" : "go down"

  if (setup.status === "active") {
    const dist = (liveDistancePips ?? setup.distanceToEntryPips).toFixed(0)
    return {
      type: "eligible",
      reason: `${pair} needs to move ${dist} more pips before this trade can be placed. The system will watch and wait.`,
    }
  }

  if (setup.status === "approaching") {
    if (setup.confirmationPattern) {
      return {
        type: "eligible",
        reason: `Price is at the zone and showed a "${setup.confirmationPattern.replace(/_/g, " ")}" pattern — placing the trade now.`,
      }
    }
    if (setup.confirmationCandlesWaited > 0) {
      return {
        type: "eligible",
        reason: `Price reached the zone but hasn't shown signs of turning around yet. Watched for ${setup.confirmationCandlesWaited} candle${setup.confirmationCandlesWaited !== 1 ? "s" : ""} so far — needs a clear reversal sign (like a strong candle in the opposite direction) before entering.`,
      }
    }
    return {
      type: "eligible",
      reason: `Price is very close to the entry zone. The system is watching for a clear sign that ${pair} will ${dir} before placing the trade — this prevents entering if price is just passing through.`,
    }
  }

  return { type: "eligible" }
}
