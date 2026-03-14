/**
 * Trend Detection Algorithm
 *
 * Methodology (from training slides):
 * - Swing Low: price stops falling, starts rising. Low of the lowest closing candle.
 * - Swing High: price stops rising, starts falling. High of the highest closing candle.
 * - Segment: price move between consecutive swing points.
 * - Uptrend: Higher Lows + Higher Highs (3 segments: up → down → up with HH).
 * - Downtrend: Lower Highs + Lower Lows (reversed).
 * - Termination: price crosses the controlling swing level.
 * - Identification: scan right-to-left from current price.
 */

import type {
  ZoneCandle,
  TrendData,
  TrendDetectionConfig,
  SwingPoint,
  SwingPointLabel,
  TrendSegment,
  TrendDirection,
  TrendStatus,
} from "@fxflow/types"
import { priceToPips } from "./pip-utils"
import { computeATR } from "./zone-utils"
import { getDefaultSwingStrength } from "./trend-defaults"

/** Maximum number of candles to process. Inputs exceeding this are sliced to the most recent candles. */
const MAX_CANDLES = 500

let nextId = 0
function uid(): string {
  return `sw_${Date.now()}_${++nextId}`
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Detect the trend direction and status from OHLC candle data using swing point analysis.
 *
 * Algorithm: detects swing highs/lows via N-bar pivot, filters by ATR to remove noise,
 * then scans right-to-left for Higher-Highs/Higher-Lows (uptrend) or Lower-Highs/Lower-Lows
 * (downtrend). A trend is "terminated" when price crosses the controlling swing level.
 *
 * @param candles - OHLC candle data (requires at least 10 candles).
 * @param instrument - OANDA instrument name (e.g., "EUR_USD"), used for pip calculations.
 * @param timeframe - Timeframe label (e.g., "H1"), used for adaptive swing strength.
 * @param config - Detection parameters (swing strength, min segment ATR, max swing points).
 * @param currentPrice - Current market price, used for termination detection.
 * @returns Trend data including direction, status, swing points, segments, and controlling swing.
 */
export function detectTrend(
  candles: ZoneCandle[],
  instrument: string,
  timeframe: string,
  config: TrendDetectionConfig,
  currentPrice: number,
): TrendData {
  if (candles.length > MAX_CANDLES) {
    console.warn(
      `[detectTrend] Input has ${candles.length} candles, exceeding MAX_CANDLES (${MAX_CANDLES}). Slicing to most recent ${MAX_CANDLES}.`,
    )
    candles = candles.slice(-MAX_CANDLES)
  }

  const n = candles.length
  if (n < 10) {
    return emptyTrend(instrument, timeframe, currentPrice, n)
  }

  // Use adaptive swing strength if config matches default
  const strength = config.swingStrength || getDefaultSwingStrength(timeframe)

  // Step 1: Compute ATR for noise filtering
  const atrValues = computeATR(candles, 14)
  const _currentAtr = atrValues[atrValues.length - 1] ?? 0

  // Step 2: Detect raw swing points
  const rawSwings = detectSwingPoints(candles, strength)

  // Step 3: Filter insignificant swings (too close together relative to ATR)
  const filtered = filterSwingsByAtr(
    rawSwings,
    candles,
    atrValues,
    config.minSegmentAtr,
    instrument,
  )

  // Step 4: Limit to maxSwingPoints (keep most recent)
  const swings = filtered.slice(-config.maxSwingPoints)

  if (swings.length < 3) {
    return emptyTrend(instrument, timeframe, currentPrice, n)
  }

  // Step 5: Build segments between consecutive swings
  const segments = buildSegments(swings, instrument)

  // Step 6: Identify trend direction and status (right-to-left scan)
  const { direction, status, controllingSwing } = identifyTrend(swings, currentPrice)

  // Step 7: Label swing points based on trend context
  labelSwingPoints(swings, direction)

  // Step 8: Mark breakout segment
  markBreakoutSegment(segments, swings, direction)

  // Compute controlling swing distance
  let controllingSwingDistancePips: number | null = null
  if (controllingSwing) {
    controllingSwingDistancePips = priceToPips(
      instrument,
      Math.abs(currentPrice - controllingSwing.price),
    )
  }

  return {
    instrument,
    timeframe,
    direction,
    status,
    swingPoints: swings,
    segments,
    controllingSwing,
    controllingSwingDistancePips,
    currentPrice,
    candlesAnalyzed: n,
    computedAt: new Date().toISOString(),
  }
}

// ─── Step 2: Swing Point Detection (N-Bar Method) ────────────────────────────

/**
 * Detects swing highs and lows using the N-bar method.
 * A swing low occurs when candle[i].close is the lowest close in [i-N, i+N].
 * The swing price is the low (wick) of that candle.
 * A swing high occurs when candle[i].close is the highest close in [i-N, i+N].
 * The swing price is the high (wick) of that candle.
 */
function detectSwingPoints(candles: ZoneCandle[], strength: number): SwingPoint[] {
  const swings: SwingPoint[] = []
  const n = candles.length

  for (let i = strength; i < n - strength; i++) {
    const c = candles[i]!

    // Check for swing low: close is lowest in window
    let isSwingLow = true
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue
      if (candles[j]!.close <= c.close) {
        isSwingLow = false
        break
      }
    }

    // Check for swing high: close is highest in window
    let isSwingHigh = true
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue
      if (candles[j]!.close >= c.close) {
        isSwingHigh = false
        break
      }
    }

    if (isSwingLow) {
      swings.push({
        id: uid(),
        type: "low",
        price: c.low, // Use wick low as the swing price
        time: c.time,
        label: "L", // Placeholder — labeled in Step 7
        candleIndex: i,
      })
    } else if (isSwingHigh) {
      swings.push({
        id: uid(),
        type: "high",
        price: c.high, // Use wick high as the swing price
        time: c.time,
        label: "H", // Placeholder — labeled in Step 7
        candleIndex: i,
      })
    }
  }

  // Deduplicate consecutive same-type swings — keep the more extreme one
  return deduplicateSwings(swings)
}

/**
 * If two or more consecutive swings share the same type, keep only the most extreme.
 * For consecutive lows, keep the lowest. For consecutive highs, keep the highest.
 */
function deduplicateSwings(swings: SwingPoint[]): SwingPoint[] {
  if (swings.length <= 1) return swings

  const result: SwingPoint[] = [swings[0]!]

  for (let i = 1; i < swings.length; i++) {
    const current = swings[i]!
    const last = result[result.length - 1]!

    if (current.type === last.type) {
      // Same type — keep the more extreme
      if (current.type === "low" && current.price < last.price) {
        result[result.length - 1] = current
      } else if (current.type === "high" && current.price > last.price) {
        result[result.length - 1] = current
      }
      // Otherwise keep the existing one
    } else {
      result.push(current)
    }
  }

  return result
}

// ─── Step 3: Filter by ATR ───────────────────────────────────────────────────

/**
 * Removes swing points that create segments smaller than minSegmentAtr × ATR.
 * This filters out market noise and insignificant micro-swings.
 */
function filterSwingsByAtr(
  swings: SwingPoint[],
  candles: ZoneCandle[],
  atrValues: number[],
  minSegmentAtr: number,
  _instrument: string,
): SwingPoint[] {
  if (swings.length <= 2 || minSegmentAtr <= 0) return swings

  const result: SwingPoint[] = [swings[0]!]

  for (let i = 1; i < swings.length; i++) {
    const current = swings[i]!
    const prev = result[result.length - 1]!
    const atrAtSwing = atrValues[current.candleIndex] ?? atrValues[atrValues.length - 1] ?? 0

    if (atrAtSwing <= 0) {
      result.push(current)
      continue
    }

    const distance = Math.abs(current.price - prev.price)
    const threshold = atrAtSwing * minSegmentAtr

    if (distance >= threshold) {
      result.push(current)
    }
    // Otherwise skip this swing — too close to the previous one
  }

  return result
}

// ─── Step 5: Build Segments ──────────────────────────────────────────────────

function buildSegments(swings: SwingPoint[], instrument: string): TrendSegment[] {
  const segments: TrendSegment[] = []

  for (let i = 0; i < swings.length - 1; i++) {
    const from = swings[i]!
    const to = swings[i + 1]!
    const dir: TrendDirection = to.price > from.price ? "up" : "down"

    segments.push({
      id: uid(),
      from,
      to,
      direction: dir,
      rangePips: priceToPips(instrument, Math.abs(to.price - from.price)),
      candleCount: Math.abs(to.candleIndex - from.candleIndex),
      isBreakout: false, // Set in Step 8
    })
  }

  return segments
}

// ─── Step 6: Identify Trend (Right-to-Left Scan) ────────────────────────────

interface TrendIdentification {
  direction: TrendDirection | null
  status: TrendStatus
  controllingSwing: SwingPoint | null
}

/**
 * Scans the most recent swing points to determine trend direction.
 *
 * For an uptrend, we need (from oldest to newest):
 *   L → H → HL (higher low) → HH (higher high)
 *   where HL > L and HH > H
 *
 * For a downtrend:
 *   H → L → LH (lower high) → LL (lower low)
 *   where LH < H and LL < L
 *
 * Then checks if the trend has been terminated (price crossed controlling swing).
 */
function identifyTrend(swings: SwingPoint[], currentPrice: number): TrendIdentification {
  // We need at least 4 swing points to identify a trend
  if (swings.length < 4) {
    return { direction: null, status: "forming", controllingSwing: null }
  }

  // Try to find the most recent trend pattern by scanning from the right
  // We look for the last 4+ alternating swing points

  // Collect the last several swing lows and highs
  const recentLows: SwingPoint[] = []
  const recentHighs: SwingPoint[] = []

  // Scan right-to-left to collect swing points
  for (
    let i = swings.length - 1;
    i >= 0 && (recentLows.length < 3 || recentHighs.length < 3);
    i--
  ) {
    const sw = swings[i]!
    if (sw.type === "low" && recentLows.length < 3) recentLows.unshift(sw)
    if (sw.type === "high" && recentHighs.length < 3) recentHighs.unshift(sw)
  }

  // Check for uptrend: Higher Lows + Higher Highs
  const uptrendResult = checkUptrend(recentLows, recentHighs, currentPrice)
  if (uptrendResult) return uptrendResult

  // Check for downtrend: Lower Highs + Lower Lows
  const downtrendResult = checkDowntrend(recentLows, recentHighs, currentPrice)
  if (downtrendResult) return downtrendResult

  // No clear trend
  return { direction: null, status: "forming", controllingSwing: null }
}

function checkUptrend(
  lows: SwingPoint[],
  highs: SwingPoint[],
  currentPrice: number,
): TrendIdentification | null {
  if (lows.length < 2 || highs.length < 2) return null

  // Check last two lows: must be ascending (Higher Lows)
  const prevLow = lows[lows.length - 2]!
  const lastLow = lows[lows.length - 1]!
  if (lastLow.price <= prevLow.price) return null

  // Check last two highs: must be ascending (Higher Highs)
  const prevHigh = highs[highs.length - 2]!
  const lastHigh = highs[highs.length - 1]!
  if (lastHigh.price <= prevHigh.price) return null

  // The higher low must come after the first high (proper sequence)
  if (lastLow.time <= prevHigh.time) return null

  // Controlling swing is the most recent higher low
  const controllingSwing = lastLow

  // Check for termination: price has crossed below the controlling swing low
  if (currentPrice < controllingSwing.price) {
    return { direction: "up", status: "terminated", controllingSwing }
  }

  return { direction: "up", status: "confirmed", controllingSwing }
}

function checkDowntrend(
  lows: SwingPoint[],
  highs: SwingPoint[],
  currentPrice: number,
): TrendIdentification | null {
  if (lows.length < 2 || highs.length < 2) return null

  // Check last two highs: must be descending (Lower Highs)
  const prevHigh = highs[highs.length - 2]!
  const lastHigh = highs[highs.length - 1]!
  if (lastHigh.price >= prevHigh.price) return null

  // Check last two lows: must be descending (Lower Lows)
  const prevLow = lows[lows.length - 2]!
  const lastLow = lows[lows.length - 1]!
  if (lastLow.price >= prevLow.price) return null

  // The lower high must come after the first low (proper sequence)
  if (lastHigh.time <= prevLow.time) return null

  // Controlling swing is the most recent lower high
  const controllingSwing = lastHigh

  // Check for termination: price has crossed above the controlling swing high
  if (currentPrice > controllingSwing.price) {
    return { direction: "down", status: "terminated", controllingSwing }
  }

  return { direction: "down", status: "confirmed", controllingSwing }
}

// ─── Step 7: Label Swing Points ─────────────────────────────────────────────

/**
 * Labels each swing point relative to its predecessor of the same type.
 * First of each type gets the base label (H/L).
 * Subsequent ones get comparative labels (HH/HL/LH/LL).
 */
function labelSwingPoints(swings: SwingPoint[], _direction: TrendDirection | null): void {
  let lastHigh: SwingPoint | null = null
  let lastLow: SwingPoint | null = null

  for (const sw of swings) {
    if (sw.type === "high") {
      if (!lastHigh) {
        sw.label = "H"
      } else {
        sw.label = sw.price > lastHigh.price ? "HH" : "LH"
      }
      lastHigh = sw
    } else {
      if (!lastLow) {
        sw.label = "L"
      } else {
        sw.label = sw.price > lastLow.price ? "HL" : "LL"
      }
      lastLow = sw
    }
  }
}

// ─── Step 8: Mark Breakout Segment ──────────────────────────────────────────

/**
 * Marks the segment that confirmed the trend as the breakout segment.
 * For uptrend: the up segment that created the first Higher High.
 * For downtrend: the down segment that created the first Lower Low.
 */
function markBreakoutSegment(
  segments: TrendSegment[],
  swings: SwingPoint[],
  direction: TrendDirection | null,
): void {
  if (!direction || segments.length < 3) return

  // Find the breakout swing (first HH in uptrend, first LL in downtrend)
  const targetLabel: SwingPointLabel = direction === "up" ? "HH" : "LL"
  const breakoutSwing = swings.find((sw) => sw.label === targetLabel)
  if (!breakoutSwing) return

  // The breakout segment ends at this swing point
  const breakoutSeg = segments.find((s) => s.to.id === breakoutSwing.id)
  if (breakoutSeg) {
    breakoutSeg.isBreakout = true
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyTrend(
  instrument: string,
  timeframe: string,
  currentPrice: number,
  candlesAnalyzed: number,
): TrendData {
  return {
    instrument,
    timeframe,
    direction: null,
    status: "forming",
    swingPoints: [],
    segments: [],
    controllingSwing: null,
    controllingSwingDistancePips: null,
    currentPrice,
    candlesAnalyzed,
    computedAt: new Date().toISOString(),
  }
}
