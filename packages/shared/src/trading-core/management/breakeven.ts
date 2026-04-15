/**
 * Breakeven decision math.
 *
 * Returns a `BreakevenDecision` describing whether the rule should fire and
 * what the new SL price would be. Callers handle the side effects (OANDA
 * modify, DB update, activity emit, debounce tracking).
 *
 * Two input shapes are supported because SmartFlow and EdgeFinder express
 * their breakeven triggers differently:
 *
 *   - **ATR multiple** (SmartFlow): threshold = `breakevenAtrMultiple × ATR`
 *     expressed in pips, then scaled by a session multiplier. This lets
 *     breakeven fire on absolute profit regardless of the initial SL.
 *
 *   - **Risk multiple** (EdgeFinder): threshold = `riskPips × breakevenTriggerRR`.
 *     Fires at 1:1 R:R or whatever multiple the config specifies.
 *
 * Both reduce to "profit in pips ≥ threshold in pips", so we just accept the
 * threshold directly. Callers compute it in whichever style they prefer.
 *
 * @module trading-core/management/breakeven
 */

import { getPipSize } from "../../pip-utils"
import type { TradeDirection } from "../types"
import { isBetterSL } from "./profit"

export interface BreakevenDecision {
  /** Whether the breakeven rule should fire. */
  shouldFire: boolean
  /** The new SL price if `shouldFire` is true, otherwise null. */
  newSL: number | null
  /** Why the decision was made (for logs / diagnostics). */
  reason: string
}

export interface BreakevenEvalOpts {
  instrument: string
  direction: TradeDirection
  entryPrice: number
  currentSL: number | null
  /** Current realised profit in pips (positive = winning). */
  profitPips: number
  /** Profit-pip threshold at which breakeven should fire. */
  thresholdPips: number
  /** Buffer in pips beyond entry. 2 pips is typical. */
  bufferPips: number
  /** Whether the rule has already fired for this trade. */
  alreadyApplied: boolean
}

/**
 * Decide whether the breakeven rule should fire and compute the new SL.
 * No side effects — caller orchestrates.
 */
export function evaluateBreakeven(opts: BreakevenEvalOpts): BreakevenDecision {
  if (opts.alreadyApplied) {
    return { shouldFire: false, newSL: null, reason: "already applied" }
  }
  if (opts.profitPips < opts.thresholdPips) {
    return {
      shouldFire: false,
      newSL: null,
      reason: `profit ${opts.profitPips.toFixed(1)}p < threshold ${opts.thresholdPips.toFixed(1)}p`,
    }
  }
  const pipSize = getPipSize(opts.instrument)
  const bufferPrice = opts.bufferPips * pipSize
  const newSL =
    opts.direction === "long" ? opts.entryPrice + bufferPrice : opts.entryPrice - bufferPrice

  if (!isBetterSL(opts.direction, opts.currentSL, newSL)) {
    return {
      shouldFire: false,
      newSL: null,
      reason: "new SL would widen existing stop",
    }
  }

  return {
    shouldFire: true,
    newSL,
    reason: `profit ${opts.profitPips.toFixed(1)}p >= threshold ${opts.thresholdPips.toFixed(1)}p`,
  }
}
