/**
 * Auto-trade queue — computes priority-ordered queue positions for eligible setups
 * and categorizes skip reasons as "capped" (temporary) vs "blocked" (permanent).
 *
 * @module auto-trade-queue
 */
import type {
  TradeFinderSetupData,
  TradeFinderConfigData,
  TradeFinderPairConfig,
} from "@fxflow/types"

/** Skip reason category: "capped" = eligible but cap hit, "blocked" = not eligible */
export type SkipCategory = "capped" | "blocked"

/** Cap-related keywords in skip reasons that indicate temporary (queue-able) blocks */
const CAP_KEYWORDS = ["concurrent", "risk"]

/**
 * Categorize a skip reason as "capped" (will auto-place when slot opens) or
 * "blocked" (won't auto-place — score/R:R/instrument issue).
 */
export function categorizeSkipReason(reason: string): SkipCategory {
  const lower = reason.toLowerCase()
  return CAP_KEYWORDS.some((kw) => lower.includes(kw)) ? "capped" : "blocked"
}

/**
 * Compute priority-ordered queue positions for active/approaching setups
 * that pass score + R:R + per-pair checks but are blocked by caps.
 *
 * @returns Map of setupId → 1-indexed queue position
 */
export function computeQueuePositions(
  setups: TradeFinderSetupData[],
  config: TradeFinderConfigData,
  hasExistingPositionFn?: (instrument: string) => boolean,
): Map<string, number> {
  const pairMap = new Map<string, TradeFinderPairConfig>()
  for (const p of config.pairs) pairMap.set(p.instrument, p)

  // Filter to setups that would be eligible if caps weren't hit
  const eligible = setups.filter((s) => {
    if (s.status !== "active" && s.status !== "approaching") return false
    if (s.autoPlaced || s.resultSourceId) return false
    if (s.scores.total < config.autoTradeMinScore) return false

    const rrNum = parseFloat(s.rrRatio)
    if (!isNaN(rrNum) && rrNum < config.autoTradeMinRR) return false

    const pair = pairMap.get(s.instrument)
    if (!pair || pair.autoTradeEnabled === false) return false

    if (hasExistingPositionFn && hasExistingPositionFn(s.instrument)) return false

    return true
  })

  // Sort by score DESC, then distance to entry ASC (approaching first)
  eligible.sort((a, b) => {
    if (b.scores.total !== a.scores.total) return b.scores.total - a.scores.total
    return a.distanceToEntryPips - b.distanceToEntryPips
  })

  const positions = new Map<string, number>()
  for (let i = 0; i < eligible.length; i++) {
    positions.set(eligible[i]!.id, i + 1)
  }
  return positions
}
