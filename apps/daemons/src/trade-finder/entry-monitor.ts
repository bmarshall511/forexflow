/**
 * Entry confirmation pattern detection for Trade Finder.
 *
 * Instead of placing LIMIT orders at the raw zone proximal, this module
 * checks recent LTF candles for confirmation patterns that indicate
 * institutional order flow is reversing at the zone. This improves win
 * rate by filtering out zones that get sliced through without a bounce.
 *
 * Confirmation patterns detected:
 * - Engulfing: bullish engulfing at demand, bearish engulfing at supply
 * - Pin bar: long wick rejection from zone with small body
 * - Inside bar breakout: inside bar forms in zone, next candle breaks in setup direction
 */

import type { ZoneData } from "@fxflow/types"

export interface ConfirmationCandle {
  open: number
  high: number
  low: number
  close: number
}

export interface ConfirmationResult {
  confirmed: boolean
  pattern: string | null
  /** Refined entry price (confirmation candle close) — null if not confirmed */
  refinedEntry: number | null
}

/**
 * Check recent candles for entry confirmation patterns at a zone.
 *
 * @param zone - The zone to check confirmation for
 * @param recentCandles - Last N LTF candles (newest last), typically 3-6
 * @param direction - "long" or "short"
 * @returns Confirmation result with pattern name and refined entry price
 */
export function detectConfirmationPattern(
  zone: ZoneData,
  recentCandles: ConfirmationCandle[],
  direction: "long" | "short",
): ConfirmationResult {
  const noConfirm: ConfirmationResult = { confirmed: false, pattern: null, refinedEntry: null }
  if (recentCandles.length < 2) return noConfirm

  const last = recentCandles[recentCandles.length - 1]!
  const prev = recentCandles[recentCandles.length - 2]!

  // Only check candles that actually touched the zone
  const touchedZone =
    direction === "long"
      ? last.low <= zone.proximalLine || prev.low <= zone.proximalLine
      : last.high >= zone.proximalLine || prev.high >= zone.proximalLine
  if (!touchedZone) return noConfirm

  // 1. Engulfing pattern
  const engulfing = detectEngulfing(last, prev, direction)
  if (engulfing) {
    return { confirmed: true, pattern: "engulfing", refinedEntry: last.close }
  }

  // 2. Pin bar / Hammer
  const pinBar = detectPinBar(last, direction)
  if (pinBar) {
    return { confirmed: true, pattern: "pin_bar", refinedEntry: last.close }
  }

  // 3. Inside bar breakout (need 3 candles: mother, inside, breakout)
  if (recentCandles.length >= 3) {
    const mother = recentCandles[recentCandles.length - 3]!
    const insideBar = detectInsideBarBreakout(mother, prev, last, direction)
    if (insideBar) {
      return { confirmed: true, pattern: "inside_bar_breakout", refinedEntry: last.close }
    }
  }

  // 4. Break of Structure (need 5+ candles for swing detection)
  if (recentCandles.length >= 5) {
    const bos = detectBreakOfStructure(recentCandles, direction)
    if (bos) {
      return { confirmed: true, pattern: "break_of_structure", refinedEntry: last.close }
    }
  }

  return noConfirm
}

/** Bullish engulfing at demand, bearish engulfing at supply */
function detectEngulfing(
  current: ConfirmationCandle,
  prev: ConfirmationCandle,
  direction: "long" | "short",
): boolean {
  const currBody = Math.abs(current.close - current.open)
  const prevBody = Math.abs(prev.close - prev.open)
  if (currBody === 0 || prevBody === 0) return false

  if (direction === "long") {
    // Bullish engulfing: prev is bearish, current is bullish and engulfs prev body
    return (
      prev.close < prev.open && // prev bearish
      current.close > current.open && // current bullish
      current.close > prev.open && // current close above prev open
      current.open <= prev.close && // current open at or below prev close
      currBody > prevBody * 0.8 // current body meaningfully larger
    )
  } else {
    // Bearish engulfing: prev is bullish, current is bearish and engulfs prev body
    return (
      prev.close > prev.open && // prev bullish
      current.close < current.open && // current bearish
      current.close < prev.open && // current close below prev open
      current.open >= prev.close && // current open at or above prev close
      currBody > prevBody * 0.8
    )
  }
}

/** Pin bar / Hammer: long wick rejection with small body */
function detectPinBar(candle: ConfirmationCandle, direction: "long" | "short"): boolean {
  const body = Math.abs(candle.close - candle.open)
  const range = candle.high - candle.low
  if (range === 0) return false

  const bodyRatio = body / range
  if (bodyRatio > 0.35) return false // Body must be small relative to range

  if (direction === "long") {
    // Hammer: long lower wick (rejection from below)
    const lowerWick = Math.min(candle.open, candle.close) - candle.low
    return lowerWick / range >= 0.6 && candle.close >= candle.open // close >= open (bullish body)
  } else {
    // Inverted hammer / shooting star: long upper wick (rejection from above)
    const upperWick = candle.high - Math.max(candle.open, candle.close)
    return upperWick / range >= 0.6 && candle.close <= candle.open // close <= open (bearish body)
  }
}

/** Inside bar that breaks out in the setup direction */
function detectInsideBarBreakout(
  mother: ConfirmationCandle,
  inside: ConfirmationCandle,
  breakout: ConfirmationCandle,
  direction: "long" | "short",
): boolean {
  // Inside bar: completely within mother's range
  const isInside = inside.high <= mother.high && inside.low >= mother.low
  if (!isInside) return false

  if (direction === "long") {
    // Breakout above inside bar high with bullish close
    return breakout.close > inside.high && breakout.close > breakout.open
  } else {
    // Breakout below inside bar low with bearish close
    return breakout.close < inside.low && breakout.close < breakout.open
  }
}

/** Break of Structure: recent candle broke a swing point in the setup direction */
function detectBreakOfStructure(
  candles: ConfirmationCandle[],
  direction: "long" | "short",
): boolean {
  if (candles.length < 5) return false

  // Find recent swing highs/lows (simple 2-bar pivot)
  const swingHighs: number[] = []
  const swingLows: number[] = []
  for (let i = 1; i < candles.length - 1; i++) {
    if (candles[i]!.high > candles[i - 1]!.high && candles[i]!.high > candles[i + 1]!.high) {
      swingHighs.push(candles[i]!.high)
    }
    if (candles[i]!.low < candles[i - 1]!.low && candles[i]!.low < candles[i + 1]!.low) {
      swingLows.push(candles[i]!.low)
    }
  }

  const last = candles[candles.length - 1]!

  if (direction === "long" && swingHighs.length > 0) {
    // BOS for longs: last candle closes above the most recent swing high
    const recentSwingHigh = swingHighs[swingHighs.length - 1]!
    return last.close > recentSwingHigh && last.close > last.open
  }

  if (direction === "short" && swingLows.length > 0) {
    // BOS for shorts: last candle closes below the most recent swing low
    const recentSwingLow = swingLows[swingLows.length - 1]!
    return last.close < recentSwingLow && last.close < last.open
  }

  return false
}

/**
 * Check if price is arriving at the zone with dangerous momentum.
 * Fast arrivals (3+ large-body candles in the same direction) indicate
 * displacement that will likely slice through the zone.
 */
export function checkArrivalSpeed(
  recentCandles: ConfirmationCandle[],
  direction: "long" | "short",
  atr: number,
): { safe: boolean; reason: string } {
  if (recentCandles.length < 3 || atr <= 0) return { safe: true, reason: "" }

  const last3 = recentCandles.slice(-3)
  const avgBody = last3.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / 3

  // Check if all 3 candles are moving TOWARD the zone (opposing direction)
  const allBearish = last3.every((c) => c.close < c.open)
  const allBullish = last3.every((c) => c.close > c.open)

  // For longs (demand zone): danger if price is falling fast toward zone (all bearish)
  // For shorts (supply zone): danger if price is rising fast toward zone (all bullish)
  const momentumTowardZone =
    (direction === "long" && allBearish) || (direction === "short" && allBullish)

  if (momentumTowardZone && avgBody > atr * 0.8) {
    return {
      safe: false,
      reason: "Momentum arrival — 3 large-body candles approaching zone",
    }
  }

  return { safe: true, reason: "" }
}
