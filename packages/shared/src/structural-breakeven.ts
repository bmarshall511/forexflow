/**
 * Structural breakeven confirmation — checks for swing point confirmation
 * before allowing breakeven SL moves.
 *
 * Instead of moving to BE purely on R:R distance, this requires
 * price to have created a structural swing point in the trade direction,
 * confirming the move is structural (not just a spike).
 *
 * @module structural-breakeven
 */
import type { Candle } from "./technical-indicators"

export interface StructuralConfirmation {
  /** Whether structural confirmation exists */
  confirmed: boolean
  /** The confirming swing point price (or null) */
  swingPrice: number | null
  /** Explanation for the result */
  reason: string
}

/**
 * Check if price has created a new swing point in the trade direction since entry.
 *
 * For longs: requires a Higher Low (HL) — a pullback low that's higher than entry.
 * For shorts: requires a Lower High (LH) — a bounce high that's lower than entry.
 *
 * @param direction - "long" or "short"
 * @param entryPrice - Trade entry price
 * @param candles - Candles since trade was filled (chronological)
 * @param lookback - Number of candles to confirm a swing point (default 3)
 * @returns Whether structural confirmation exists
 */
export function checkStructuralConfirmation(
  direction: "long" | "short",
  entryPrice: number,
  candles: Candle[],
  lookback = 3,
): StructuralConfirmation {
  if (candles.length < lookback * 2 + 1) {
    return { confirmed: false, swingPrice: null, reason: "Not enough candles for swing detection" }
  }

  if (direction === "long") {
    return checkHigherLow(entryPrice, candles, lookback)
  }
  return checkLowerHigh(entryPrice, candles, lookback)
}

/** For longs: find a swing low that's above entry price */
function checkHigherLow(
  entryPrice: number,
  candles: Candle[],
  lookback: number,
): StructuralConfirmation {
  // Scan for swing lows (local minimums)
  for (let i = lookback; i < candles.length - lookback; i++) {
    const low = candles[i]!.low
    let isSwingLow = true

    // Check lookback candles on each side
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j]!.low <= low || candles[i + j]!.low <= low) {
        isSwingLow = false
        break
      }
    }

    if (isSwingLow && low > entryPrice) {
      return {
        confirmed: true,
        swingPrice: low,
        reason: `Higher Low at ${low.toFixed(5)} (above entry ${entryPrice.toFixed(5)})`,
      }
    }
  }

  return { confirmed: false, swingPrice: null, reason: "No Higher Low formed above entry" }
}

/** For shorts: find a swing high that's below entry price */
function checkLowerHigh(
  entryPrice: number,
  candles: Candle[],
  lookback: number,
): StructuralConfirmation {
  for (let i = lookback; i < candles.length - lookback; i++) {
    const high = candles[i]!.high
    let isSwingHigh = true

    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j]!.high >= high || candles[i + j]!.high >= high) {
        isSwingHigh = false
        break
      }
    }

    if (isSwingHigh && high < entryPrice) {
      return {
        confirmed: true,
        swingPrice: high,
        reason: `Lower High at ${high.toFixed(5)} (below entry ${entryPrice.toFixed(5)})`,
      }
    }
  }

  return { confirmed: false, swingPrice: null, reason: "No Lower High formed below entry" }
}
