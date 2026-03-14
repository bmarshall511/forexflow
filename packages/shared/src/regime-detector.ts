// Market regime detection — pure TypeScript, no runtime-specific imports.

import type { Candle } from "./technical-indicators"
import { computeADX, computeBollingerBands, computeEMA } from "./technical-indicators"
import { computeATR } from "./zone-utils"

// ─── Types ──────────────────────────────────────────────────────────────────

/** The four market regime classifications. */
export type MarketRegime = "trending" | "ranging" | "volatile" | "low_volatility"

/** Market regime detection result with supporting indicator values. */
export interface RegimeResult {
  /** The detected market regime. */
  regime: MarketRegime
  /** Classification confidence (0-100). */
  confidence: number
  /** ADX value used in the classification. */
  adx: number
  /** ATR as a percentage of current price (measures volatility magnitude). */
  atrPercent: number
  /** Bollinger Band width (measures relative volatility). */
  bbWidth: number
}

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Detect the current market regime by combining ADX, ATR%, Bollinger Band width, and EMA alignment.
 *
 * Classification logic:
 * - **volatile**: ATR% and BB width both significantly above their historical averages.
 * - **low_volatility**: BB width well below historical average (Bollinger squeeze).
 * - **trending**: ADX > 25 with EMA 20/50 clearly separated.
 * - **ranging**: default when no other condition is met (ADX < 20 strengthens confidence).
 *
 * @param candles - OHLCV candle data (requires at least 50 candles for meaningful results).
 * @returns Regime classification with confidence score and supporting indicator values.
 */
export function detectRegime(candles: Candle[]): RegimeResult {
  const fallback: RegimeResult = {
    regime: "ranging",
    confidence: 0,
    adx: 0,
    atrPercent: 0,
    bbWidth: 0,
  }
  if (candles.length < 50) return fallback

  // Compute indicators
  const adxResult = computeADX(candles)
  const adx = adxResult?.adx ?? 0

  const bb = computeBollingerBands(candles)
  const bbWidth = bb?.bandwidth ?? 0

  // ATR as percentage of current price
  // computeATR expects ZoneCandle which is compatible with Candle
  // Candle is a structural superset of ZoneCandle (extra `volume` field is fine)
  const atrValues = computeATR(candles, 14)
  const currentATR = atrValues.length > 0 ? atrValues[atrValues.length - 1]! : 0
  const currentPrice = candles[candles.length - 1]!.close
  const atrPercent = currentPrice !== 0 ? (currentATR / currentPrice) * 100 : 0

  // Historical BB width for comparison (average of last 50 candles' worth)
  const halfLen = Math.floor(candles.length / 2)
  const olderBB = computeBollingerBands(candles.slice(0, halfLen))
  const avgBBWidth = olderBB ? (olderBB.bandwidth + bbWidth) / 2 : bbWidth

  // Historical ATR% average
  const olderPrice = candles[halfLen]?.close ?? currentPrice
  const olderATR = halfLen > 14 ? (atrValues[halfLen - 1] ?? currentATR) : currentATR
  const avgATRPercent =
    olderPrice !== 0 ? ((olderATR / olderPrice) * 100 + atrPercent) / 2 : atrPercent

  // EMA alignment check for trending confirmation
  const ema20 = computeEMA(candles, 20)
  const ema50 = computeEMA(candles, 50)
  const emaAligned =
    ema20 !== null && ema50 !== null && Math.abs(ema20 - ema50) / currentPrice > 0.001

  // ─── Classification ─────────────────────────────────────────────────────
  let regime: MarketRegime
  let confidence: number

  if (atrPercent > avgATRPercent * 1.5 && bbWidth > avgBBWidth * 1.3) {
    regime = "volatile"
    const volatilityExcess = atrPercent / (avgATRPercent || 1)
    confidence = Math.min(100, Math.round(50 + volatilityExcess * 15))
  } else if (bbWidth < avgBBWidth * 0.5) {
    regime = "low_volatility"
    const squeeze = avgBBWidth !== 0 ? 1 - bbWidth / avgBBWidth : 0.5
    confidence = Math.min(100, Math.round(50 + squeeze * 50))
  } else if (adx > 25 && emaAligned) {
    regime = "trending"
    const adxStrength = Math.min((adx - 25) / 25, 1) // 25-50 range mapped to 0-1
    confidence = Math.min(100, Math.round(60 + adxStrength * 40))
  } else {
    regime = "ranging"
    const adxWeakness = adx < 20 ? (20 - adx) / 20 : 0
    confidence = Math.min(100, Math.round(40 + adxWeakness * 40))
  }

  return { regime, confidence, adx, atrPercent, bbWidth }
}
