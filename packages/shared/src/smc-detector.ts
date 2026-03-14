// Smart Money Concepts (SMC) detection algorithms
// Pure TypeScript — no runtime-specific imports

import type { Candle } from "./technical-indicators"

/** A swing high or low detected by the N-bar pivot method for SMC analysis. */
export interface SwingPoint {
  type: "high" | "low"
  price: number
  time: number
  /** Candle index within the input array. */
  index: number
}

/**
 * A market structure shift event.
 * BOS (Break of Structure) confirms trend continuation.
 * CHoCH (Change of Character) signals a potential trend reversal.
 */
export interface MarketStructureEvent {
  /** "bos" = continuation, "choch" = reversal. */
  type: "bos" | "choch"
  direction: "bullish" | "bearish"
  /** The price level that was broken. */
  level: number
  /** Timestamp when the break occurred. */
  time: number
  /** The swing point that was broken. */
  swingBroken: SwingPoint
}

/**
 * A Fair Value Gap (FVG) — a three-candle imbalance where price moved so fast
 * that a gap exists between the first and third candle wicks. Unmitigated FVGs
 * act as magnets for price to return and fill.
 */
export interface FairValueGap {
  /** "bullish" = gap below price (support), "bearish" = gap above price (resistance). */
  type: "bullish" | "bearish"
  /** Upper boundary of the gap. */
  high: number
  /** Lower boundary of the gap. */
  low: number
  /** Midpoint of the gap (common fill target). */
  midpoint: number
  /** Size of the gap in price units. */
  gapSize: number
  /** Timestamp of the middle candle that created the gap. */
  time: number
  /** Candle index of the middle candle. */
  index: number
  /** Whether price has returned to fill this gap. */
  mitigated: boolean
}

/**
 * An Order Block — the last opposing candle before an impulsive move.
 * Bullish OB: last bearish candle before a strong rally (institutional demand).
 * Bearish OB: last bullish candle before a strong drop (institutional supply).
 */
export interface OrderBlock {
  /** "bullish" = demand OB (buy zone), "bearish" = supply OB (sell zone). */
  type: "bullish" | "bearish"
  /** High of the order block candle. */
  high: number
  /** Low of the order block candle. */
  low: number
  /** Timestamp of the order block candle. */
  time: number
  /** Candle index of the order block. */
  index: number
  /** Size of the impulsive move away from the OB (validates institutional interest). */
  displacement: number
}

/**
 * A Liquidity Sweep — price probes beyond equal highs/lows (stop-loss clusters)
 * then reverses, indicating institutional stop-hunting.
 */
export interface LiquiditySweep {
  /** "bullish" = swept lows then reversed up, "bearish" = swept highs then reversed down. */
  type: "bullish" | "bearish"
  /** The equal-level price that was swept. */
  level: number
  /** Highest price reached during the sweep candle. */
  sweepHigh: number
  /** Lowest price reached during the sweep candle. */
  sweepLow: number
  /** Timestamp of the sweep candle. */
  time: number
  /** Candle index of the sweep. */
  index: number
}

/**
 * A group of swing points at approximately the same price level.
 * Equal highs/lows indicate liquidity pools where stop-loss orders cluster.
 */
export interface EqualLevel {
  type: "equal_highs" | "equal_lows"
  /** Average price of the grouped swings. */
  price: number
  /** Number of swings forming this equal level. */
  count: number
  /** The individual swing points that comprise this level. */
  swings: SwingPoint[]
}

/**
 * Detect swing highs and lows using the N-bar pivot method.
 * A swing high/low must be the highest/lowest point within `strength` bars on each side.
 *
 * @param candles - OHLCV candle data.
 * @param strength - Number of bars on each side required to confirm a swing (default 3).
 * @returns Array of swing points sorted by time.
 */
export function detectSwingPoints(candles: Candle[], strength = 3): SwingPoint[] {
  const points: SwingPoint[] = []
  if (candles.length < strength * 2 + 1) return points

  for (let i = strength; i < candles.length - strength; i++) {
    const curr = candles[i]!
    let isHigh = true
    let isLow = true
    for (let j = 1; j <= strength; j++) {
      if (curr.high <= candles[i - j]!.high || curr.high <= candles[i + j]!.high) isHigh = false
      if (curr.low >= candles[i - j]!.low || curr.low >= candles[i + j]!.low) isLow = false
    }
    if (isHigh) points.push({ type: "high", price: curr.high, time: curr.time, index: i })
    if (isLow) points.push({ type: "low", price: curr.low, time: curr.time, index: i })
  }

  return points.sort((a, b) => a.time - b.time)
}

/**
 * Detect market structure events (BOS and CHoCH) from a series of swing points.
 * BOS (Break of Structure) confirms trend continuation when a swing is broken in the trend direction.
 * CHoCH (Change of Character) signals reversal when a swing is broken against the trend.
 *
 * @param swings - Swing points from `detectSwingPoints` (requires at least 4).
 * @returns Array of structure events in chronological order.
 */
export function detectMarketStructure(swings: SwingPoint[]): MarketStructureEvent[] {
  const events: MarketStructureEvent[] = []
  if (swings.length < 4) return events

  let trend: "up" | "down" | "none" = "none"
  let lastHigh: SwingPoint | null = null
  let lastLow: SwingPoint | null = null

  const emit = (broken: SwingPoint, dir: "bullish" | "bearish", time: number) => {
    const isContinuation =
      (dir === "bullish" && trend === "up") || (dir === "bearish" && trend === "down")
    const isReversal =
      (dir === "bullish" && trend === "down") || (dir === "bearish" && trend === "up")
    if (isContinuation) {
      events.push({ type: "bos", direction: dir, level: broken.price, time, swingBroken: broken })
    } else if (isReversal) {
      events.push({ type: "choch", direction: dir, level: broken.price, time, swingBroken: broken })
      trend = dir === "bullish" ? "up" : "down"
    } else {
      trend = dir === "bullish" ? "up" : "down"
    }
  }

  for (const swing of swings) {
    if (swing.type === "high") {
      if (lastHigh && lastLow && swing.price > lastHigh.price) emit(lastHigh, "bullish", swing.time)
      lastHigh = swing
    } else {
      if (lastLow && lastHigh && swing.price < lastLow.price) emit(lastLow, "bearish", swing.time)
      lastLow = swing
    }
  }
  return events
}

/**
 * Detect Fair Value Gaps (FVGs) — three-candle imbalance patterns.
 * A bullish FVG occurs when candle[i-1].high < candle[i+1].low (gap up).
 * A bearish FVG occurs when candle[i-1].low > candle[i+1].high (gap down).
 *
 * @param candles - OHLCV candle data.
 * @param minGapPips - Minimum gap size to include (default 0, includes all).
 * @returns Array of detected FVGs with mitigation status.
 */
export function detectFairValueGaps(candles: Candle[], minGapPips = 0): FairValueGap[] {
  const gaps: FairValueGap[] = []

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]!
    const curr = candles[i]!
    const next = candles[i + 1]!

    // Bullish FVG: gap between prev high and next low
    if (prev.high < next.low) {
      const gapSize = next.low - prev.high
      if (gapSize >= minGapPips) {
        gaps.push({
          type: "bullish",
          high: next.low,
          low: prev.high,
          midpoint: (next.low + prev.high) / 2,
          gapSize,
          time: curr.time,
          index: i,
          mitigated: isFvgMitigated(candles, i + 2, prev.high, next.low, "bullish"),
        })
      }
    }
    // Bearish FVG: gap between next high and prev low
    if (prev.low > next.high) {
      const gapSize = prev.low - next.high
      if (gapSize >= minGapPips) {
        gaps.push({
          type: "bearish",
          high: prev.low,
          low: next.high,
          midpoint: (prev.low + next.high) / 2,
          gapSize,
          time: curr.time,
          index: i,
          mitigated: isFvgMitigated(candles, i + 2, next.high, prev.low, "bearish"),
        })
      }
    }
  }
  return gaps
}

function isFvgMitigated(
  candles: Candle[],
  startIdx: number,
  gapLow: number,
  gapHigh: number,
  type: "bullish" | "bearish",
): boolean {
  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i]!
    const bodyLow = Math.min(c.open, c.close)
    const bodyHigh = Math.max(c.open, c.close)
    if (type === "bullish" && bodyLow <= gapHigh) return true
    if (type === "bearish" && bodyHigh >= gapLow) return true
  }
  return false
}

/**
 * Detect Order Blocks: the last opposing candle before an impulsive move.
 * Requires displacement of at least 2x the candle body size within 5 bars.
 *
 * @param candles - OHLCV candle data.
 * @param swings - Swing points used to identify impulsive move targets.
 * @returns Array of detected order blocks.
 */
export function detectOrderBlocks(candles: Candle[], swings: SwingPoint[]): OrderBlock[] {
  const blocks: OrderBlock[] = []
  const swingIdxByType = {
    high: new Set(swings.filter((s) => s.type === "high").map((s) => s.index)),
    low: new Set(swings.filter((s) => s.type === "low").map((s) => s.index)),
  }

  for (let i = 1; i < candles.length - 1; i++) {
    const c = candles[i]!
    const bodySize = Math.abs(c.close - c.open)
    if (bodySize === 0) continue

    // Bullish OB: bearish candle before impulsive up-move
    if (c.close < c.open) {
      for (let j = i + 1; j < Math.min(i + 6, candles.length); j++) {
        const cj = candles[j]!
        if (swingIdxByType.high.has(j) || cj.close > c.high) {
          const move = cj.high - c.low
          if (move >= bodySize * 2) {
            blocks.push({
              type: "bullish",
              high: c.high,
              low: c.low,
              time: c.time,
              index: i,
              displacement: move,
            })
            break
          }
        }
      }
    }
    // Bearish OB: bullish candle before impulsive down-move
    if (c.close > c.open) {
      for (let j = i + 1; j < Math.min(i + 6, candles.length); j++) {
        const cj = candles[j]!
        if (swingIdxByType.low.has(j) || cj.close < c.low) {
          const move = c.high - cj.low
          if (move >= bodySize * 2) {
            blocks.push({
              type: "bearish",
              high: c.high,
              low: c.low,
              time: c.time,
              index: i,
              displacement: move,
            })
            break
          }
        }
      }
    }
  }
  return blocks
}

/**
 * Detect Liquidity Sweeps: price probes beyond equal highs/lows then closes back inside.
 * This pattern indicates institutional stop-hunting before a reversal.
 *
 * @param candles - OHLCV candle data.
 * @param swings - Swing points used to find equal levels for sweep detection.
 * @returns Array of detected liquidity sweeps.
 */
export function detectLiquiditySweeps(candles: Candle[], swings: SwingPoint[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = []
  const equalLevels = detectEqualLevels(swings)

  for (const level of equalLevels) {
    const lastSwingIdx = Math.max(...level.swings.map((s) => s.index))
    for (let i = lastSwingIdx + 1; i < candles.length; i++) {
      const c = candles[i]!
      const isHighSweep =
        level.type === "equal_highs" && c.high > level.price && c.close < level.price
      const isLowSweep = level.type === "equal_lows" && c.low < level.price && c.close > level.price
      if (isHighSweep || isLowSweep) {
        sweeps.push({
          type: isLowSweep ? "bullish" : "bearish",
          level: level.price,
          sweepHigh: c.high,
          sweepLow: c.low,
          time: c.time,
          index: i,
        })
        break
      }
    }
  }
  return sweeps
}

/**
 * Find groups of swing highs or lows clustering at the same price level.
 * Equal levels indicate liquidity pools where stop-losses accumulate,
 * making them targets for institutional sweep moves.
 *
 * @param swings - Swing points to group.
 * @param tolerancePct - Maximum percentage difference to consider swings "equal" (default 0.1%).
 * @returns Array of equal levels, each containing at least 2 swings.
 */
export function detectEqualLevels(swings: SwingPoint[], tolerancePct = 0.1): EqualLevel[] {
  const highs = swings.filter((s) => s.type === "high")
  const lows = swings.filter((s) => s.type === "low")
  return [
    ...groupEqualSwings(highs, tolerancePct, "equal_highs"),
    ...groupEqualSwings(lows, tolerancePct, "equal_lows"),
  ]
}

function groupEqualSwings(
  swings: SwingPoint[],
  tolerancePct: number,
  type: EqualLevel["type"],
): EqualLevel[] {
  const levels: EqualLevel[] = []
  const used = new Set<number>()

  for (let i = 0; i < swings.length; i++) {
    if (used.has(i)) continue
    const anchor = swings[i]!
    const group = [anchor]
    const threshold = anchor.price * (tolerancePct / 100)

    for (let j = i + 1; j < swings.length; j++) {
      if (!used.has(j) && Math.abs(swings[j]!.price - anchor.price) <= threshold) {
        group.push(swings[j]!)
        used.add(j)
      }
    }
    if (group.length >= 2) {
      used.add(i)
      const avgPrice = group.reduce((sum, s) => sum + s.price, 0) / group.length
      levels.push({ type, price: avgPrice, count: group.length, swings: group })
    }
  }
  return levels
}
