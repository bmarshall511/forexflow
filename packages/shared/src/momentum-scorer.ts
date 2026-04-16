/**
 * Momentum confluence scorer for Trade Finder.
 * Evaluates RSI conditions at zone levels for entry quality.
 *
 * Score range: 0-1
 * - RSI oversold at demand zone (< 35) or overbought at supply zone (> 65): +0.5
 * - RSI divergence at zone: +0.5
 *
 * @module momentum-scorer
 */
import type { OddsEnhancerScore, ZoneType } from "@fxflow/types"
import type { Candle } from "./technical-indicators"
import { computeRSI } from "./technical-indicators"

/**
 * Score momentum confluence for a zone.
 *
 * @param zoneType - "demand" or "supply"
 * @param candles - Recent LTF candles (need at least 15 for RSI-14)
 * @returns OddsEnhancerScore with value 0-1
 */
export function scoreMomentumConfluence(zoneType: ZoneType, candles: Candle[]): OddsEnhancerScore {
  if (candles.length < 15) {
    return {
      value: 0,
      max: 1,
      label: "Momentum",
      explanation: "Insufficient candle data for RSI calculation",
    }
  }

  let score = 0
  const parts: string[] = []

  // Current RSI
  const rsi = computeRSI(candles)
  if (rsi !== null) {
    if (zoneType === "demand" && rsi < 35) {
      score += 0.5
      parts.push(`RSI oversold (${rsi.toFixed(0)})`)
    } else if (zoneType === "supply" && rsi > 65) {
      score += 0.5
      parts.push(`RSI overbought (${rsi.toFixed(0)})`)
    }
  }

  // RSI divergence check (simplified — compare last 2 swing points)
  const divergence = detectSimpleRSIDivergence(zoneType, candles)
  if (divergence) {
    score += 0.5
    parts.push(divergence)
  }

  // Cap at max 1
  score = Math.min(1, score)

  return {
    value: score,
    max: 1,
    label: "Momentum",
    explanation: parts.length > 0 ? parts.join("; ") : "No momentum confluence at zone",
  }
}

/**
 * Simplified RSI divergence detection.
 * Looks for price making new lows while RSI makes higher lows (bullish divergence at demand)
 * or price making new highs while RSI makes lower highs (bearish divergence at supply).
 */
function detectSimpleRSIDivergence(zoneType: ZoneType, candles: Candle[]): string | null {
  if (candles.length < 30) return null

  // Split candles into two halves and compare RSI
  const midpoint = Math.floor(candles.length / 2)
  const firstHalf = candles.slice(0, midpoint)
  const secondHalf = candles.slice(midpoint)

  const rsiFirst = computeRSI(firstHalf)
  const rsiSecond = computeRSI(secondHalf)
  if (rsiFirst === null || rsiSecond === null) return null

  if (zoneType === "demand") {
    // Bullish divergence: price lower, RSI higher
    const priceFirst = Math.min(...firstHalf.map((c) => c.low))
    const priceSecond = Math.min(...secondHalf.map((c) => c.low))
    if (priceSecond < priceFirst && rsiSecond > rsiFirst) {
      return "Bullish RSI divergence"
    }
  } else {
    // Bearish divergence: price higher, RSI lower
    const priceFirst = Math.max(...firstHalf.map((c) => c.high))
    const priceSecond = Math.max(...secondHalf.map((c) => c.high))
    if (priceSecond > priceFirst && rsiSecond < rsiFirst) {
      return "Bearish RSI divergence"
    }
  }

  return null
}
