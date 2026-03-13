import type { ZoneCandle, ClassifiedCandle, ZoneDetectionConfig, ZoneType } from "@fxflow/types"
import { getPipSize } from "./pip-utils"

// ─── ATR Calculation ────────────────────────────────────────────────────────

/** Compute Average True Range for each candle using Wilder's smoothing. */
export function computeATR(candles: ZoneCandle[], period: number): number[] {
  const n = candles.length
  if (n === 0) return []

  const atr = new Array<number>(n).fill(0)

  // True Range for each candle (first candle uses high-low only)
  const tr = new Array<number>(n)
  tr[0] = candles[0]!.high - candles[0]!.low
  for (let i = 1; i < n; i++) {
    const c = candles[i]!
    const prevClose = candles[i - 1]!.close
    tr[i] = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose))
  }

  // Initial ATR: SMA of first `period` true ranges
  if (n < period) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += tr[i]!
      atr[i] = sum / (i + 1)
    }
    return atr
  }

  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += tr[i]!
    atr[i] = sum / (i + 1) // partial averages for early candles
  }
  atr[period - 1] = sum / period

  // Wilder's smoothing for the rest
  for (let i = period; i < n; i++) {
    atr[i] = (atr[i - 1]! * (period - 1) + tr[i]!) / period
  }

  return atr
}

// ─── Candle Classification ──────────────────────────────────────────────────

/** Classify each candle as leg, base, or neutral based on body ratios and ATR. */
export function classifyCandles(
  candles: ZoneCandle[],
  config: ZoneDetectionConfig,
): ClassifiedCandle[] {
  const atr = computeATR(candles, config.atrPeriod)

  return candles.map((c, i) => {
    const bodySize = Math.abs(c.close - c.open)
    const range = c.high - c.low
    const bodyRatio = range > 0 ? bodySize / range : 0
    const isBullish = c.close >= c.open
    const bodyVsAtr = atr[i]! > 0 ? bodySize / atr[i]! : 0

    let classification: ClassifiedCandle["classification"]
    if (bodyRatio >= config.minLegBodyRatio && bodyVsAtr >= config.minLegBodyAtr) {
      classification = "leg"
    } else if (bodyRatio <= config.maxBaseBodyRatio && bodyVsAtr < config.minLegBodyAtr * 0.8) {
      // Base: small body relative to range AND small body relative to ATR
      // Both conditions required — prevents strong directional candles from being
      // classified as base just because one metric is low.
      classification = "base"
    } else {
      classification = "neutral"
    }

    return { ...c, classification, bodySize, range, bodyRatio, isBullish, bodyVsAtr }
  })
}

// ─── Explosive Move Detection ───────────────────────────────────────────────

export interface ExplosiveMoveResult {
  startIdx: number
  endIdx: number
  isExplosive: boolean
  consecutiveLegs: number
  direction: "up" | "down"
}

/**
 * Check for an explosive move starting at startIdx going forward.
 * - "up": bullish leg candles with higher closes
 * - "down": bearish leg candles with lower closes
 *
 * Allows up to 1 non-leg candle gap within the move (e.g. a small pullback
 * candle between two strong legs). The gap candle must still close in the
 * correct direction. Trailing non-leg candles are excluded — endIdx always
 * points to the last actual leg candle.
 */
export function detectExplosiveMove(
  candles: ClassifiedCandle[],
  startIdx: number,
  direction: "up" | "down",
  minLegCandles: number,
): ExplosiveMoveResult {
  const MAX_GAP = 1 // Allow at most 1 non-leg candle between legs
  let lastLegIdx = -1
  let legCount = 0
  let gapCount = 0

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i]!
    const isLeg = c.classification === "leg"
    const correctDirection = direction === "up" ? c.isBullish : !c.isBullish

    if (i === startIdx) {
      // First candle must be a leg in the correct direction
      if (!isLeg || !correctDirection) break
      legCount++
      lastLegIdx = i
      continue
    }

    // Every subsequent candle must close in the correct direction
    const prevClose = candles[i - 1]!.close
    const closesInDirection = direction === "up" ? c.close > prevClose : c.close < prevClose
    if (!closesInDirection) break

    if (isLeg && correctDirection) {
      legCount++
      lastLegIdx = i
      gapCount = 0 // Reset gap counter on a proper leg
    } else {
      gapCount++
      if (gapCount > MAX_GAP) break // Too many non-leg candles in a row
    }
  }

  return {
    startIdx,
    endIdx: lastLegIdx >= startIdx ? lastLegIdx : startIdx,
    isExplosive: legCount >= minLegCandles,
    consecutiveLegs: legCount,
    direction,
  }
}

// ─── Base Cluster Finding ───────────────────────────────────────────────────

export interface BaseCluster {
  startIdx: number
  endIdx: number
  candles: ClassifiedCandle[]
  legInIdx: number // Index of the last leg-in candle (immediately before the base)
}

/**
 * Walk left from legOutIdx to find the base cluster.
 *
 * ONLY candles classified as "base" are included in the cluster. Neutral and
 * leg candles terminate the walk — this prevents directional candles from
 * leaking into the base and creating oversized zones.
 *
 * The leg-in candle (the candle that precedes the base) must be a classified
 * "leg" or a near-leg candle (bodyVsAtr >= threshold AND bodyRatio >= 0.35).
 */
export function findBaseCluster(
  candles: ClassifiedCandle[],
  legOutIdx: number,
  maxBaseCandles: number,
  legInAtrThreshold: number = 0.7,
): BaseCluster | null {
  const baseCandles: ClassifiedCandle[] = []
  let baseStartIdx = legOutIdx - 1

  for (let i = legOutIdx - 1; i >= 0; i--) {
    const c = candles[i]!

    // Only "base" classified candles belong in the cluster.
    // Anything else (leg, neutral) terminates the walk.
    if (c.classification !== "base") {
      baseStartIdx = i + 1
      break
    }

    baseCandles.unshift(c)
    baseStartIdx = i

    if (baseCandles.length > maxBaseCandles) return null

    if (i === 0) return null // Reached start without finding leg-in
  }

  if (baseCandles.length === 0) return null

  // The leg-in candle is immediately before the base
  const legInIdx = baseStartIdx - 1
  if (legInIdx < 0) return null

  // Verify leg-in is a leg or near-leg candle
  const legIn = candles[legInIdx]!
  const isValidLegIn = legIn.classification === "leg" ||
    (legIn.bodyVsAtr >= legInAtrThreshold && legIn.bodyRatio >= 0.35)
  if (!isValidLegIn) return null

  return {
    startIdx: baseStartIdx,
    endIdx: legOutIdx - 1,
    candles: baseCandles,
    legInIdx,
  }
}

// ─── Higher Timeframe Mapping ───────────────────────────────────────────────

const TIMEFRAME_HIERARCHY: Record<string, string | null> = {
  M1: "M5",
  M5: "M15",
  M15: "M30",
  M30: "H1",
  H1: "H4",
  H4: "D",
  D: "W",
  W: "M",
  M: null,
}

/** Get the next higher timeframe (one level up). Returns null for monthly. */
export function getHigherTimeframe(timeframe: string): string | null {
  return TIMEFRAME_HIERARCHY[timeframe] ?? null
}

// ─── Zone Width ─────────────────────────────────────────────────────────────

/** Compute zone width in price and pips. */
export function computeZoneWidth(
  proximal: number,
  distal: number,
  instrument: string,
): { width: number; widthPips: number } {
  const pipSize = getPipSize(instrument)
  const width = Math.abs(proximal - distal)
  const widthPips = width / pipSize
  return { width, widthPips }
}

// ─── Freshness Calculation ──────────────────────────────────────────────────

/**
 * Compute how many times and how deeply price has returned to a zone after formation.
 * Scans candles after the zone's leg-out to measure penetration.
 */
export function computeFreshness(
  zoneType: ZoneType,
  proximalLine: number,
  distalLine: number,
  candles: ZoneCandle[],
  afterIndex: number,
): { testCount: number; penetrationPercent: number } {
  const zoneWidth = Math.abs(proximalLine - distalLine)
  if (zoneWidth === 0) return { testCount: 0, penetrationPercent: 0 }

  let testCount = 0
  let maxPenetration = 0
  let inZone = false

  for (let i = afterIndex; i < candles.length; i++) {
    const c = candles[i]!

    if (zoneType === "demand") {
      // Demand: proximal > distal. Price enters from above (drops into zone).
      if (c.low <= proximalLine) {
        if (!inZone) {
          testCount++
          inZone = true
        }
        const penetrationPrice = proximalLine - c.low
        const pct = Math.min(penetrationPrice / zoneWidth, 1)
        maxPenetration = Math.max(maxPenetration, pct)
      } else {
        inZone = false
      }
    } else {
      // Supply: proximal < distal. Price enters from below (rallies into zone).
      if (c.high >= proximalLine) {
        if (!inZone) {
          testCount++
          inZone = true
        }
        const penetrationPrice = c.high - proximalLine
        const pct = Math.min(penetrationPrice / zoneWidth, 1)
        maxPenetration = Math.max(maxPenetration, pct)
      } else {
        inZone = false
      }
    }
  }

  return { testCount, penetrationPercent: maxPenetration }
}

// ─── Zone Status from Current Price ─────────────────────────────────────────

/** Determine zone status based on current price position relative to zone. */
export function getZoneStatus(
  zoneType: ZoneType,
  proximalLine: number,
  distalLine: number,
  currentPrice: number,
): "active" | "tested" | "invalidated" {
  if (zoneType === "demand") {
    // Demand zone: proximal > distal, price should be above
    if (currentPrice > proximalLine) return "active"
    if (currentPrice > distalLine) return "tested"
    return "invalidated"
  } else {
    // Supply zone: proximal < distal, price should be below
    if (currentPrice < proximalLine) return "active"
    if (currentPrice < distalLine) return "tested"
    return "invalidated"
  }
}
