/**
 * Pip math primitives for trade-management rules.
 *
 * Both SmartFlow's `management-engine.ts` and EdgeFinder's `trade-manager.ts`
 * compute profit in pips and risk in pips dozens of times per tick. This
 * module is the single source of truth for those calculations so the two
 * daemons can never drift on sign conventions or pip-size handling.
 *
 * @module trading-core/management/profit
 */

import { getPipSize } from "../../pip-utils"
import type { TradeDirection } from "../types"

/**
 * Profit in pips given an entry price, current price, and direction.
 * Positive for winning trades, negative for losing trades.
 */
export function computeProfitPips(opts: {
  instrument: string
  direction: TradeDirection
  entryPrice: number
  currentPrice: number
}): number {
  const pipSize = getPipSize(opts.instrument)
  const delta =
    opts.direction === "long"
      ? opts.currentPrice - opts.entryPrice
      : opts.entryPrice - opts.currentPrice
  return delta / pipSize
}

/**
 * Risk distance in pips from entry to the current stop-loss.
 * Always non-negative — if SL is on the wrong side of entry, returns 0.
 */
export function computeRiskPips(opts: {
  instrument: string
  direction: TradeDirection
  entryPrice: number
  stopLoss: number
}): number {
  const pipSize = getPipSize(opts.instrument)
  const { direction, entryPrice, stopLoss } = opts
  const distance = direction === "long" ? entryPrice - stopLoss : stopLoss - entryPrice
  if (distance <= 0) return 0
  return distance / pipSize
}

/**
 * Returns true if `proposedSL` is a ratchet — tighter (more favourable) than
 * `currentSL` for the given direction. A null current SL is treated as
 * "anything is better" so fresh positions accept the first SL write.
 */
export function isBetterSL(
  direction: TradeDirection,
  currentSL: number | null,
  proposedSL: number,
): boolean {
  if (currentSL == null) return true
  return direction === "long" ? proposedSL > currentSL : proposedSL < currentSL
}
