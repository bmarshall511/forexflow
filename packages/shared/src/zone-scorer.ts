import type {
  ZoneType,
  ZoneFormationType,
  ZoneScores,
  OddsEnhancerScore,
  ZoneDetectionConfig,
  ClassifiedCandle,
  ZoneCandle,
  TrendData,
  CurveData,
  ZoneData,
} from "@fxflow/types"
import { computeFreshness } from "./zone-utils"
import { getPipSize, priceToPips } from "./pip-utils"
import { scoreCommodityCorrelation } from "./commodity-correlation"

// ─── Internal Types ─────────────────────────────────────────────────────────

/** Raw zone candidate passed to the scorer before final ZoneData assembly */
export interface RawZoneCandidate {
  type: ZoneType
  formation: ZoneFormationType
  instrument: string
  proximalLine: number
  distalLine: number
  baseStartIndex: number
  baseEndIndex: number
  baseCandles: number
  /** Index of the first leg-out candle */
  legOutStartIndex: number
  /** Index of the last leg-out candle */
  legOutEndIndex: number
  /** Index of the leg-in candle (last leg candle before the base) */
  legInIndex: number
}

// ─── Strength Scoring ───────────────────────────────────────────────────────

/**
 * Score Strength (0, 1, or 2).
 *
 * Sub-component A: Move-out distance relative to zone width (0 or 1).
 *   Measures from proximal line to the most extreme price of the leg-out candles.
 *   Score 1 if moveOutDistance >= minMoveOutMultiple * zoneWidth.
 *
 * Sub-component B: Breakout past opposing zone (0 or 1).
 *   For demand: did the rally break above a preceding supply zone's proximal?
 *   For supply: did the drop break below a preceding demand zone's proximal?
 */
function scoreStrength(
  zone: RawZoneCandidate,
  candles: ClassifiedCandle[],
  opposingZones: RawZoneCandidate[],
  config: ZoneDetectionConfig,
): OddsEnhancerScore {
  const pipSize = getPipSize(zone.instrument)
  const zoneWidth = Math.abs(zone.proximalLine - zone.distalLine)

  // Sub-component A: Move-out distance
  let moveOutExtreme: number
  if (zone.type === "demand") {
    // Rally leg-out: find highest price
    moveOutExtreme = -Infinity
    for (let i = zone.legOutStartIndex; i <= zone.legOutEndIndex; i++) {
      moveOutExtreme = Math.max(moveOutExtreme, candles[i]!.high)
    }
  } else {
    // Drop leg-out: find lowest price
    moveOutExtreme = Infinity
    for (let i = zone.legOutStartIndex; i <= zone.legOutEndIndex; i++) {
      moveOutExtreme = Math.min(moveOutExtreme, candles[i]!.low)
    }
  }

  const moveOutDistance = zone.type === "demand"
    ? moveOutExtreme - zone.proximalLine
    : zone.proximalLine - moveOutExtreme
  const moveOutMultiple = zoneWidth > 0 ? moveOutDistance / zoneWidth : 0
  const moveOutPips = moveOutDistance / pipSize
  const moveOutScore = moveOutMultiple >= config.minMoveOutMultiple ? 1 : 0

  // Sub-component B: Breakout past opposing zone
  let breakoutScore = 0
  let breakoutExplanation = "no opposing zone breakout"

  for (const opp of opposingZones) {
    // Only consider opposing zones that formed before this zone
    if (opp.baseEndIndex >= zone.baseStartIndex) continue

    if (zone.type === "demand" && opp.type === "supply") {
      // Demand rally breaking above supply zone's proximal line
      if (moveOutExtreme > opp.proximalLine) {
        breakoutScore = 1
        breakoutExplanation = "broke past opposing supply zone"
        break
      }
    } else if (zone.type === "supply" && opp.type === "demand") {
      // Supply drop breaking below demand zone's proximal line
      if (moveOutExtreme < opp.proximalLine) {
        breakoutScore = 1
        breakoutExplanation = "broke past opposing demand zone"
        break
      }
    }
  }

  const total = moveOutScore + breakoutScore
  const moveLabel = moveOutScore > 0
    ? `Strong move out (${moveOutPips.toFixed(1)} pips, ${moveOutMultiple.toFixed(1)}x zone width)`
    : `Weak move out (${moveOutPips.toFixed(1)} pips, ${moveOutMultiple.toFixed(1)}x zone width)`

  const labels: Record<number, string> = { 0: "Poor", 1: "Good", 2: "Best" }

  return {
    value: total,
    max: 2,
    label: labels[total] ?? "Poor",
    explanation: total === 2
      ? `${moveLabel} + ${breakoutExplanation}`
      : total === 1
        ? moveOutScore > 0 ? `${moveLabel}, ${breakoutExplanation}` : `Moderate move out, ${breakoutExplanation}`
        : `${moveLabel}, ${breakoutExplanation}`,
  }
}

// ─── Time Scoring ───────────────────────────────────────────────────────────

/**
 * Score Time (0, 0.5, or 1).
 *
 * Based on the number of basing candles:
 * - 1-3 candles → 1 (Best): minimal time at zone, most unfilled orders
 * - 4-6 candles → 0.5 (Good): moderate time at zone
 * - >6 candles  → 0 (Poor): extended time, fewer unfilled orders
 */
function scoreTime(baseCandles: number): OddsEnhancerScore {
  let value: number
  let label: string
  let explanation: string

  if (baseCandles <= 3) {
    value = 1
    label = "Best"
    explanation = `${baseCandles} basing candle${baseCandles !== 1 ? "s" : ""} \u2014 minimal time at zone`
  } else if (baseCandles <= 6) {
    value = 0.5
    label = "Good"
    explanation = `${baseCandles} basing candles \u2014 moderate time at zone`
  } else {
    value = 0
    label = "Poor"
    explanation = `${baseCandles} basing candles \u2014 extended time at zone`
  }

  return { value, max: 1, label, explanation }
}

// ─── Freshness Scoring ──────────────────────────────────────────────────────

/**
 * Score Freshness (0, 1, or 2).
 *
 * Based on how far price has returned to and penetrated the zone:
 * - Not tested at all → 2 (Best): maximum unfilled orders remain
 * - Tested ≤ threshold (default 50%) → 1 (Good): some orders filled
 * - Tested > threshold → 0 (Poor): most orders likely filled
 */
function scoreFreshness(
  zone: RawZoneCandidate,
  candles: ZoneCandle[],
  config: ZoneDetectionConfig,
): { score: OddsEnhancerScore; testCount: number; penetrationPercent: number } {
  const { testCount, penetrationPercent } = computeFreshness(
    zone.type,
    zone.proximalLine,
    zone.distalLine,
    candles,
    zone.legOutEndIndex + 1,
  )

  let value: number
  let label: string
  let explanation: string
  const pctDisplay = Math.round(penetrationPercent * 100)

  if (testCount === 0) {
    value = 2
    label = "Best"
    explanation = "Zone never tested \u2014 maximum unfilled orders remain"
  } else if (penetrationPercent <= config.freshTestedThreshold) {
    value = 1
    label = "Good"
    explanation = `Tested ${testCount} time${testCount > 1 ? "s" : ""}, ~${pctDisplay}% penetration \u2014 some orders filled`
  } else {
    value = 0
    label = "Poor"
    explanation = `Deeply tested (~${pctDisplay}% penetration) \u2014 most orders likely filled`
  }

  return {
    score: { value, max: 2, label, explanation },
    testCount,
    penetrationPercent,
  }
}

// ─── Main Scoring Function ──────────────────────────────────────────────────

/**
 * Compute all three Odds Enhancer scores for a zone candidate.
 * Returns ZoneScores (total 0 to 5) plus freshness metadata.
 */
export function scoreZone(
  zone: RawZoneCandidate,
  allCandles: ClassifiedCandle[],
  opposingZones: RawZoneCandidate[],
  config: ZoneDetectionConfig,
): { scores: ZoneScores; testCount: number; penetrationPercent: number } {
  const strength = scoreStrength(zone, allCandles, opposingZones, config)
  const time = scoreTime(zone.baseCandles)
  const { score: freshness, testCount, penetrationPercent } = scoreFreshness(zone, allCandles, config)

  const total = strength.value + time.value + freshness.value

  return {
    scores: { strength, time, freshness, total },
    testCount,
    penetrationPercent,
  }
}

// ─── Trend Scoring ─────────────────────────────────────────────────────────

/**
 * Score Trend alignment (0, 1, or 2).
 *
 * - 2 (Best): Confirmed trend in same direction as zone type
 *   (demand + uptrend confirmed, supply + downtrend confirmed)
 * - 1 (Good): Forming trend in same direction
 * - 0 (Poor): No trend, opposite trend, or terminated trend
 */
function scoreTrend(
  zoneType: ZoneType,
  trendData: TrendData | null,
): OddsEnhancerScore {
  if (!trendData || !trendData.direction) {
    return { value: 0, max: 2, label: "Poor", explanation: "No trend detected" }
  }

  const aligned =
    (zoneType === "demand" && trendData.direction === "up") ||
    (zoneType === "supply" && trendData.direction === "down")

  if (!aligned) {
    return {
      value: 0,
      max: 2,
      label: "Poor",
      explanation: `${trendData.direction === "up" ? "Uptrend" : "Downtrend"} opposes ${zoneType} zone`,
    }
  }

  if (trendData.status === "confirmed") {
    return {
      value: 2,
      max: 2,
      label: "Best",
      explanation: `Confirmed ${trendData.direction}trend aligns with ${zoneType} zone`,
    }
  }

  if (trendData.status === "forming") {
    return {
      value: 1,
      max: 2,
      label: "Good",
      explanation: `Forming ${trendData.direction}trend aligns with ${zoneType} zone`,
    }
  }

  return { value: 0, max: 2, label: "Poor", explanation: "Trend terminated" }
}

// ─── Curve Scoring ─────────────────────────────────────────────────────────

/**
 * Score Curve position (0 or 1).
 *
 * - 1 (Best): Price is in the correct third of the curve for this zone type
 *   (demand + price in lower third or below, supply + price in upper third or above)
 * - 0 (Poor): Price is not in the favorable curve position
 */
function scoreCurve(
  zoneType: ZoneType,
  curveData: CurveData | null,
): OddsEnhancerScore {
  if (!curveData) {
    return { value: 0, max: 1, label: "Poor", explanation: "No curve data available" }
  }

  const favorable =
    (zoneType === "demand" && (curveData.position === "low" || curveData.position === "below")) ||
    (zoneType === "supply" && (curveData.position === "high" || curveData.position === "above"))

  if (favorable) {
    return {
      value: 1,
      max: 1,
      label: "Best",
      explanation: `Price in ${curveData.position} curve position — favorable for ${zoneType}`,
    }
  }

  return {
    value: 0,
    max: 1,
    label: "Poor",
    explanation: `Price in ${curveData.position} curve position — not ideal for ${zoneType}`,
  }
}

// ─── Profit Zone Scoring ───────────────────────────────────────────────────

/**
 * Score Profit Zone (0, 1, 2, or 3).
 *
 * Based on the R:R ratio to the nearest opposing fresh zone:
 * - 3 (Best):  R:R >= 3:1
 * - 2 (Good):  R:R >= 2:1
 * - 1 (Fair):  R:R >= 1:1
 * - 0 (Poor):  R:R < 1:1 or no opposing zone
 */
function scoreProfitZone(
  zoneType: ZoneType,
  proximalLine: number,
  distalLine: number,
  instrument: string,
  opposingFreshZones: ZoneData[],
  currentPrice: number,
): OddsEnhancerScore {
  const pipSize = getPipSize(instrument)

  // Entry is at proximal line
  const entry = proximalLine
  // SL is at distal line (simplified — actual SL adds ATR buffer)
  const slDistance = Math.abs(entry - distalLine)
  const riskPips = slDistance / pipSize

  if (riskPips === 0) {
    return { value: 0, max: 3, label: "Poor", explanation: "Zero risk distance" }
  }

  // Find nearest opposing fresh zone for TP
  const opposingType = zoneType === "demand" ? "supply" : "demand"
  const freshOpposing = opposingFreshZones
    .filter((z) => z.type === opposingType && z.status === "active" && z.testCount === 0)
    .sort((a, b) => {
      // For demand: nearest supply above; for supply: nearest demand below
      if (zoneType === "demand") return a.proximalLine - b.proximalLine
      return b.proximalLine - a.proximalLine
    })

  let rewardPips: number
  let tpSource: string

  if (freshOpposing.length > 0) {
    const tp = freshOpposing[0]!.proximalLine
    rewardPips = Math.abs(tp - entry) / pipSize
    tpSource = "opposing fresh zone"
  } else {
    // Fallback: 2:1 R:R
    rewardPips = riskPips * 2
    tpSource = "2:1 fallback (no opposing zone)"
  }

  const rrRatio = rewardPips / riskPips

  let value: number
  let label: string
  if (rrRatio >= 3) {
    value = 3
    label = "Best"
  } else if (rrRatio >= 2) {
    value = 2
    label = "Good"
  } else if (rrRatio >= 1) {
    value = 1
    label = "Fair"
  } else {
    value = 0
    label = "Poor"
  }

  return {
    value,
    max: 3,
    label,
    explanation: `${rrRatio.toFixed(1)}:1 R:R to ${tpSource}`,
  }
}

// ─── Commodity Correlation Scoring ─────────────────────────────────────────

/**
 * Score Commodity Correlation (0 or 1).
 * Delegates to commodity-correlation module.
 */
function scoreCommodity(
  instrument: string,
  zoneType: ZoneType,
  commodityZones: ZoneData[] | null,
): OddsEnhancerScore {
  if (!commodityZones) {
    return { value: 0, max: 1, label: "N/A", explanation: "No commodity data" }
  }

  const result = scoreCommodityCorrelation(instrument, zoneType, commodityZones)
  if (!result.commodity) {
    return { value: 0, max: 1, label: "N/A", explanation: "No commodity correlation for this pair" }
  }

  return {
    value: result.value,
    max: 1,
    label: result.aligned ? "Best" : "Poor",
    explanation: result.aligned
      ? `${result.commodity} zones confirm alignment`
      : `${result.commodity} zones not aligned`,
  }
}

// ─── Extended Scoring ──────────────────────────────────────────────────────

/** Optional context for extended scoring (Trade Finder provides all of these) */
export interface ExtendedScoringContext {
  /** MTF trend data */
  trendData: TrendData | null
  /** HTF curve data */
  curveData: CurveData | null
  /** All zones for finding opposing fresh zones (typically LTF zones) */
  allZones: ZoneData[]
  /** Current price for profit zone calculation */
  currentPrice: number
  /** Commodity zones (XAU_USD, BCO_USD zones if correlated) */
  commodityZones: ZoneData[] | null
}

/**
 * Compute all 7 Odds Enhancer scores for a zone candidate.
 * Returns ZoneScores (total 0 to 12) plus freshness metadata.
 *
 * This extends the base scoreZone with 4 additional dimensions when
 * ExtendedScoringContext is provided.
 */
export function scoreZoneExtended(
  zone: RawZoneCandidate,
  allCandles: ClassifiedCandle[],
  opposingZones: RawZoneCandidate[],
  config: ZoneDetectionConfig,
  context: ExtendedScoringContext,
): { scores: ZoneScores; testCount: number; penetrationPercent: number } {
  // Base 3 scores (max 5)
  const base = scoreZone(zone, allCandles, opposingZones, config)

  // Extended 4 scores (max 7)
  const trend = scoreTrend(zone.type, context.trendData)
  const curve = scoreCurve(zone.type, context.curveData)
  const profitZone = scoreProfitZone(
    zone.type,
    zone.proximalLine,
    zone.distalLine,
    zone.instrument,
    context.allZones,
    context.currentPrice,
  )
  const commodity = scoreCommodity(zone.instrument, zone.type, context.commodityZones)

  const total =
    base.scores.strength.value +
    base.scores.time.value +
    base.scores.freshness.value +
    trend.value +
    curve.value +
    profitZone.value +
    commodity.value

  return {
    scores: {
      ...base.scores,
      trend,
      curve,
      profitZone,
      commodityCorrelation: commodity,
      total,
    },
    testCount: base.testCount,
    penetrationPercent: base.penetrationPercent,
  }
}
