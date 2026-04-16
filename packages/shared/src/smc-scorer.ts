/**
 * SMC (Smart Money Concepts) confluence scorer for Trade Finder.
 * Evaluates whether a zone aligns with institutional order flow patterns.
 *
 * Score range: 0-2
 * - Zone overlaps with an order block: +1
 * - Unfilled FVG in direction confirms zone: +0.5
 * - Recent BOS in zone direction: +0.5
 *
 * @module smc-scorer
 */
import type { OddsEnhancerScore, ZoneType } from "@fxflow/types"
import type { Candle } from "./technical-indicators"
import type { OrderBlock, FairValueGap, MarketStructureEvent, SwingPoint } from "./smc-detector"
import {
  detectSwingPoints,
  detectOrderBlocks,
  detectFairValueGaps,
  detectMarketStructure,
} from "./smc-detector"

export interface SmcScoringContext {
  /** Pre-detected swing points (or null to detect fresh) */
  swings?: SwingPoint[]
  /** Pre-detected order blocks (or null to detect fresh) */
  orderBlocks?: OrderBlock[]
  /** Pre-detected fair value gaps (or null to detect fresh) */
  fvgs?: FairValueGap[]
  /** Pre-detected market structure events (or null to detect fresh) */
  structureEvents?: MarketStructureEvent[]
}

/**
 * Score SMC confluence for a zone.
 *
 * @param zoneType - "demand" or "supply"
 * @param zoneProximal - Zone proximal line price
 * @param zoneDistal - Zone distal line price
 * @param candles - Recent LTF candles
 * @param context - Optional pre-computed SMC structures
 * @returns OddsEnhancerScore with value 0-2
 */
export function scoreSmcConfluence(
  zoneType: ZoneType,
  zoneProximal: number,
  zoneDistal: number,
  candles: Candle[],
  context?: SmcScoringContext,
): OddsEnhancerScore {
  if (candles.length < 10) {
    return {
      value: 0,
      max: 2,
      label: "SMC",
      explanation: "Insufficient candle data for SMC analysis",
    }
  }

  // Detect structures if not pre-computed
  const swings = context?.swings ?? detectSwingPoints(candles, 3)
  const orderBlocks = context?.orderBlocks ?? detectOrderBlocks(candles, swings)
  const fvgs = context?.fvgs ?? detectFairValueGaps(candles)
  const structureEvents = context?.structureEvents ?? detectMarketStructure(swings)

  let score = 0
  const parts: string[] = []
  const zoneHigh = Math.max(zoneProximal, zoneDistal)
  const zoneLow = Math.min(zoneProximal, zoneDistal)

  // 1. Order block overlap (+1)
  const obMatch = findOverlappingOrderBlock(zoneType, zoneLow, zoneHigh, orderBlocks)
  if (obMatch) {
    score += 1
    parts.push(`Overlaps ${obMatch.type} order block`)
  }

  // 2. Unfilled FVG in direction (+0.5)
  const fvgMatch = findDirectionalFVG(zoneType, zoneLow, zoneHigh, fvgs)
  if (fvgMatch) {
    score += 0.5
    parts.push(`Unfilled ${fvgMatch.type} FVG nearby`)
  }

  // 3. Recent BOS in zone direction (+0.5)
  const bosMatch = findRecentBOS(zoneType, structureEvents)
  if (bosMatch) {
    score += 0.5
    parts.push(`Recent ${bosMatch.type} (${bosMatch.direction})`)
  }

  // Cap at max 2
  score = Math.min(2, score)

  return {
    value: score,
    max: 2,
    label: "SMC",
    explanation: parts.length > 0 ? parts.join("; ") : "No SMC confluence detected",
  }
}

/** Check if any order block overlaps with the zone price range */
function findOverlappingOrderBlock(
  zoneType: ZoneType,
  zoneLow: number,
  zoneHigh: number,
  orderBlocks: OrderBlock[],
): OrderBlock | null {
  const targetType = zoneType === "demand" ? "bullish" : "bearish"

  for (const ob of orderBlocks) {
    if (ob.type !== targetType) continue

    const obHigh = Math.max(ob.high, ob.low)
    const obLow = Math.min(ob.high, ob.low)

    // Check overlap: zones overlap if one starts before the other ends
    if (zoneLow <= obHigh && zoneHigh >= obLow) {
      return ob
    }
  }
  return null
}

/** Check if there's an unfilled FVG near the zone that confirms the direction */
function findDirectionalFVG(
  zoneType: ZoneType,
  zoneLow: number,
  zoneHigh: number,
  fvgs: FairValueGap[],
): FairValueGap | null {
  const targetType = zoneType === "demand" ? "bullish" : "bearish"
  const zoneWidth = zoneHigh - zoneLow

  for (const fvg of fvgs) {
    if (fvg.type !== targetType) continue
    if (fvg.mitigated) continue // Only unfilled FVGs

    const fvgMid = (fvg.high + fvg.low) / 2

    // FVG should be near the zone (within 2x zone width)
    if (fvgMid >= zoneLow - zoneWidth * 2 && fvgMid <= zoneHigh + zoneWidth * 2) {
      return fvg
    }
  }
  return null
}

/** Check if there's a recent BOS (Break of Structure) in the zone direction */
function findRecentBOS(
  zoneType: ZoneType,
  events: MarketStructureEvent[],
): MarketStructureEvent | null {
  // Look at the most recent 3 structure events
  const recent = events.slice(-3)
  const targetDirection = zoneType === "demand" ? "bullish" : "bearish"

  for (const event of recent) {
    if (event.type === "bos" && event.direction === targetDirection) {
      return event
    }
  }
  return null
}
