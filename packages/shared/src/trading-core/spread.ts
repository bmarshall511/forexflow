/**
 * Spread validator.
 *
 * Previously implemented three times with three different thresholds:
 *
 *   SmartFlow      : spread > 20% of risk → reject
 *   EdgeFinder T1  : spread * 2 > riskPips (≈ 50% of risk) → reject
 *   EdgeFinder gate: spread > 50% of risk → reject at execution time
 *
 * The three thresholds remain valid (each system makes different speed vs.
 * quality tradeoffs) but the *math* is identical, so we centralise the
 * calculator here and let each caller pass its own `maxPercent`.
 *
 * @module trading-core/spread
 */

import type { GateResult } from "./types"
import { fail, pass } from "./types"

export interface CheckSpreadOpts {
  spreadPips: number
  riskPips: number
  /** Maximum allowed spread as a fraction of risk distance (0..1). */
  maxPercent: number
}

export function checkSpread(opts: CheckSpreadOpts): GateResult {
  const { spreadPips, riskPips, maxPercent } = opts
  if (riskPips <= 0) return pass()
  const maxSpread = riskPips * maxPercent
  if (spreadPips > maxSpread) {
    return fail(
      `Spread ${spreadPips.toFixed(1)} pips exceeds ${(maxPercent * 100).toFixed(0)}% of SL (${maxSpread.toFixed(1)} pips)`,
    )
  }
  return pass()
}

/**
 * Returns the spread impact on R:R: `spreadPips / rewardPips`, capped at 1.
 * Useful for Tier 2/3 prompts so the LLM can reason about slippage cost.
 */
export function spreadImpactPercent(spreadPips: number, rewardPips: number): number {
  if (rewardPips <= 0) return 1
  return Math.min(1, spreadPips / rewardPips)
}

/**
 * Compute raw-vs-spread-adjusted R:R. The adjusted number subtracts spread
 * from the reward side and adds it to the risk side (buying at ask, selling
 * at bid on entry, reversed on exit — spread is paid on both legs).
 */
export function spreadAdjustedRR(opts: {
  riskPips: number
  rewardPips: number
  spreadPips: number
}): { raw: number; adjusted: number } {
  const { riskPips, rewardPips, spreadPips } = opts
  const raw = riskPips > 0 ? rewardPips / riskPips : 0
  const adjustedRisk = riskPips + spreadPips
  const adjustedReward = Math.max(0, rewardPips - spreadPips)
  const adjusted = adjustedRisk > 0 ? adjustedReward / adjustedRisk : 0
  return { raw, adjusted }
}
