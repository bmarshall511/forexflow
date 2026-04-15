/**
 * Trailing-stop decision math.
 *
 * Computes a new SL price based on current price and a trail distance (in
 * price units, not pips — callers convert as needed). Applies the ratchet
 * rule: the new SL is only accepted if it's strictly better than the
 * current SL for the given direction.
 *
 * @module trading-core/management/trailing
 */

import { getPipSize } from "../../pip-utils"
import type { TradeDirection } from "../types"
import { isBetterSL } from "./profit"

export interface TrailingDecision {
  shouldFire: boolean
  newSL: number | null
  reason: string
}

export interface TrailingEvalOpts {
  instrument: string
  direction: TradeDirection
  currentPrice: number
  currentSL: number | null
  /** Trail distance in PRICE units (not pips). E.g. ATR × multiplier. */
  trailDistancePrice: number
  /**
   * When true, the trailing stop must be activated before this function is
   * called (i.e. profit has already crossed the activation threshold). When
   * false, the caller is asserting activation has happened. Either way,
   * this function does NOT check activation — that's the caller's job.
   */
  activated?: boolean
}

/**
 * Decide whether the trailing stop should move and compute the new SL.
 * No side effects. The `newSL` is rounded to pip precision.
 */
export function evaluateTrailing(opts: TrailingEvalOpts): TrailingDecision {
  if (opts.activated === false) {
    return { shouldFire: false, newSL: null, reason: "not yet activated" }
  }
  if (opts.trailDistancePrice <= 0) {
    return { shouldFire: false, newSL: null, reason: "non-positive trail distance" }
  }

  const pipSize = getPipSize(opts.instrument)
  const raw =
    opts.direction === "long"
      ? opts.currentPrice - opts.trailDistancePrice
      : opts.currentPrice + opts.trailDistancePrice
  const newSL = Math.round(raw / pipSize) * pipSize

  if (!isBetterSL(opts.direction, opts.currentSL, newSL)) {
    return {
      shouldFire: false,
      newSL: null,
      reason: "proposed SL would widen existing stop",
    }
  }

  return { shouldFire: true, newSL, reason: "ratchet to new trail" }
}
