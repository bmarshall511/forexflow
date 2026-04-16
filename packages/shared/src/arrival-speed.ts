/**
 * Arrival speed classifier for Trade Finder.
 * Classifies how price approached a zone to assess entry quality.
 *
 * - "controlled": price approaching via small-body candles (normal pullback — good)
 * - "displacement": 3+ large candles aggressively into zone (likely to break — bad)
 * - "sweep": price wicked past zone distal then closed inside (liquidity grab — best)
 *
 * @module arrival-speed
 */
import type { TradeFinderArrivalSpeed, ZoneType } from "@fxflow/types"
import type { Candle } from "./technical-indicators"

/**
 * Classify the arrival speed of price into a zone.
 *
 * @param zoneType - "demand" or "supply"
 * @param zoneProximal - Zone proximal (entry) line
 * @param zoneDistal - Zone distal (SL) line
 * @param recentCandles - Last 5-10 candles approaching the zone
 * @param atr - ATR value for body size comparison
 * @returns Arrival speed classification
 */
export function classifyArrivalSpeed(
  zoneType: ZoneType,
  zoneProximal: number,
  zoneDistal: number,
  recentCandles: Candle[],
  atr?: number,
): TradeFinderArrivalSpeed {
  if (recentCandles.length < 3) return "controlled"

  const effectiveATR = atr ?? computeSimpleATR(recentCandles)
  if (!effectiveATR || effectiveATR === 0) return "controlled"

  // Check for sweep: did any candle wick past distal then close inside zone?
  const lastCandle = recentCandles[recentCandles.length - 1]!
  if (lastCandle) {
    if (zoneType === "demand") {
      // Sweep below distal then close above it
      if (lastCandle.low < zoneDistal && lastCandle.close > zoneDistal) {
        return "sweep"
      }
    } else {
      // Sweep above distal then close below it
      if (lastCandle.high > zoneDistal && lastCandle.close < zoneDistal) {
        return "sweep"
      }
    }
  }

  // Check for displacement: 3+ large-body candles approaching zone aggressively
  const approachCandles = recentCandles.slice(-5) // Last 5 candles
  let largeBodiedCount = 0
  const threshold = effectiveATR * 0.7

  for (const candle of approachCandles) {
    const bodySize = Math.abs(candle.close - candle.open)
    if (bodySize > threshold) {
      // Check direction is toward zone
      const isMovingTowardZone =
        (zoneType === "demand" && candle.close < candle.open) || // Bearish toward demand
        (zoneType === "supply" && candle.close > candle.open) // Bullish toward supply
      if (isMovingTowardZone) {
        largeBodiedCount++
      }
    }
  }

  if (largeBodiedCount >= 3) {
    return "displacement"
  }

  return "controlled"
}

/** Simple ATR calculation from Candle[] (different from zone-utils which uses ZoneCandle[]) */
function computeSimpleATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0
  let sum = 0
  const count = Math.min(candles.length - 1, period)
  for (let i = candles.length - count; i < candles.length; i++) {
    const c = candles[i]!
    const prev = candles[i - 1]!
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
    sum += tr
  }
  return count > 0 ? sum / count : 0
}
