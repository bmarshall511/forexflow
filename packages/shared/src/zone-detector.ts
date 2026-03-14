import type {
  ZoneCandle,
  ZoneData,
  ZoneDetectionConfig,
  ZoneDetectionResult,
  ZoneFormationType,
  ZoneType,
  ZoneRiskReward,
  ClassifiedCandle,
} from "@fxflow/types"
import { getPipSize, priceToPips } from "./pip-utils"
import {
  classifyCandles,
  detectExplosiveMove,
  findBaseCluster,
  getZoneStatus,
  computeZoneWidth,
  computeATR,
} from "./zone-utils"
import { scoreZone, type RawZoneCandidate } from "./zone-scorer"

// ─── Internal Helpers ───────────────────────────────────────────────────────

/** Generate a deterministic ID from zone properties for deduplication. */
function generateZoneId(
  instrument: string,
  timeframe: string,
  type: ZoneType,
  baseStartTime: number,
  baseEndTime: number,
): string {
  return `${instrument}_${timeframe}_${type}_${baseStartTime}_${baseEndTime}`
}

/**
 * Determine the formation type from leg-in and leg-out directions.
 *
 * Leg-in direction + Leg-out direction → Formation:
 *   drop  + rally = DBR (demand)
 *   rally + rally = RBR (demand)
 *   rally + drop  = RBD (supply)
 *   drop  + drop  = DBD (supply)
 */
function determineFormation(
  legInBullish: boolean,
  legOutBullish: boolean,
): {
  formation: ZoneFormationType
  zoneType: ZoneType
} {
  if (!legInBullish && legOutBullish) return { formation: "DBR", zoneType: "demand" }
  if (legInBullish && legOutBullish) return { formation: "RBR", zoneType: "demand" }
  if (legInBullish && !legOutBullish) return { formation: "RBD", zoneType: "supply" }
  return { formation: "DBD", zoneType: "supply" }
}

/**
 * Place proximal and distal lines based on the BASE candles only.
 *
 * The zone represents the consolidation (base) area — NOT the legs.
 * This keeps zones tight and tradeable.
 *
 * DEMAND zones (DBR, RBR):
 *   Proximal = highest candle BODY (max of open, close) among base candles
 *   Distal   = lowest LOW (wick extreme) among base candles
 *
 * SUPPLY zones (RBD, DBD):
 *   Proximal = lowest candle BODY (min of open, close) among base candles
 *   Distal   = highest HIGH (wick extreme) among base candles
 */
function placeLines(
  _formation: ZoneFormationType,
  zoneType: ZoneType,
  baseCandles: ClassifiedCandle[],
): { proximalLine: number; distalLine: number } | null {
  if (baseCandles.length === 0) return null

  let proximalLine: number
  let distalLine: number

  if (zoneType === "demand") {
    // Proximal: highest body edge in the base (closest to current price above)
    proximalLine = -Infinity
    distalLine = Infinity
    for (const c of baseCandles) {
      proximalLine = Math.max(proximalLine, Math.max(c.open, c.close))
      distalLine = Math.min(distalLine, c.low)
    }
  } else {
    // Supply: proximal = lowest body edge (closest to current price below)
    proximalLine = Infinity
    distalLine = -Infinity
    for (const c of baseCandles) {
      proximalLine = Math.min(proximalLine, Math.min(c.open, c.close))
      distalLine = Math.max(distalLine, c.high)
    }
  }

  // Validate: proximal and distal must be different and in correct order
  if (proximalLine === distalLine) return null
  if (zoneType === "demand" && proximalLine <= distalLine) return null
  if (zoneType === "supply" && proximalLine >= distalLine) return null

  return { proximalLine, distalLine }
}

/**
 * Compute implied R:R from this zone to the nearest opposing zone.
 */
function computeRiskReward(
  zone: { type: ZoneType; proximalLine: number; distalLine: number },
  opposingZones: ZoneData[],
  instrument: string,
): ZoneRiskReward {
  const pipSize = getPipSize(instrument)
  const riskPips = Math.abs(zone.proximalLine - zone.distalLine) / pipSize

  // Find nearest active opposing zone
  let nearestOpposing: ZoneData | null = null
  let nearestDistance = Infinity

  for (const opp of opposingZones) {
    if (opp.type === zone.type) continue
    if (opp.status === "invalidated") continue

    const distance = Math.abs(opp.proximalLine - zone.proximalLine)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestOpposing = opp
    }
  }

  const takeProfitPrice = nearestOpposing?.proximalLine ?? null
  const rewardPips =
    takeProfitPrice !== null ? Math.abs(takeProfitPrice - zone.proximalLine) / pipSize : null
  const ratio =
    rewardPips !== null && riskPips > 0 ? `1:${(rewardPips / riskPips).toFixed(1)}` : null

  return {
    entryPrice: zone.proximalLine,
    stopLossPrice: zone.distalLine,
    takeProfitPrice,
    riskPips,
    rewardPips,
    ratio,
  }
}

/**
 * Check if two zones overlap more than a threshold percentage.
 * Used for deduplication — when two zones overlap significantly, keep the higher-scored one.
 */
function zonesOverlap(
  a: { proximalLine: number; distalLine: number; type: ZoneType },
  b: typeof a,
): number {
  // For demand: proximal > distal. Zone range is [distal, proximal].
  // For supply: proximal < distal. Zone range is [proximal, distal].
  const aLow = Math.min(a.proximalLine, a.distalLine)
  const aHigh = Math.max(a.proximalLine, a.distalLine)
  const bLow = Math.min(b.proximalLine, b.distalLine)
  const bHigh = Math.max(b.proximalLine, b.distalLine)

  const overlapLow = Math.max(aLow, bLow)
  const overlapHigh = Math.min(aHigh, bHigh)

  if (overlapHigh <= overlapLow) return 0

  const overlapWidth = overlapHigh - overlapLow
  const smallerWidth = Math.min(aHigh - aLow, bHigh - bLow)

  return smallerWidth > 0 ? overlapWidth / smallerWidth : 0
}

// ─── Main Detection ─────────────────────────────────────────────────────────

/**
 * Detect supply and demand zones from an array of OHLC candles.
 *
 * Algorithm (Base Isolation Technique):
 * 1. Classify all candles as leg/base/neutral
 * 2. Scan right-to-left for explosive moves (leg-outs)
 * 3. For each leg-out, isolate the base by walking left to the leg-in
 * 4. Determine formation type (DBR/RBR/RBD/DBD)
 * 5. Place proximal and distal lines per formation rules
 * 6. Score using Odds Enhancers (Strength, Time, Freshness)
 * 7. Filter, rank, and deduplicate
 */
export function detectZones(
  candles: ZoneCandle[],
  instrument: string,
  timeframe: string,
  config: ZoneDetectionConfig,
  currentPrice: number,
): ZoneDetectionResult {
  const emptyResult: ZoneDetectionResult = {
    instrument,
    timeframe,
    zones: [],
    nearestDemand: null,
    nearestSupply: null,
    currentPrice,
    candlesAnalyzed: candles.length,
    computedAt: new Date().toISOString(),
  }

  if (candles.length < config.atrPeriod + 3) return emptyResult

  // Step 1: Classify candles
  const classified = classifyCandles(candles, config)

  // Step 2 & 3: Scan for zones by finding explosive moves and isolating bases
  const rawCandidates: RawZoneCandidate[] = []
  const usedIndices = new Set<number>() // Prevent overlapping zone detection
  const atrValues = computeATR(candles, config.atrPeriod)

  // Helper: try to create a zone candidate from a given leg-out move and base
  const tryAddCandidate = (
    move: { startIdx: number; endIdx: number },
    base: { legInIdx: number; startIdx: number; endIdx: number; candles: ClassifiedCandle[] },
    direction: "up" | "down",
  ): boolean => {
    const legInCandle = classified[base.legInIdx]!
    const { formation, zoneType } = determineFormation(legInCandle.isBullish, direction === "up")

    const lines = placeLines(formation, zoneType, base.candles)
    if (!lines) return false

    // Reject zones wider than 1.5x local ATR — too wide to be tradeable
    const localAtr = atrValues[base.endIdx] ?? atrValues[atrValues.length - 1] ?? 0
    if (localAtr > 0) {
      const zoneWidth = Math.abs(lines.proximalLine - lines.distalLine)
      if (zoneWidth > localAtr * 1.5) return false
    }

    // Skip fully invalidated zones
    if (zoneType === "demand" && currentPrice < lines.distalLine) return false
    if (zoneType === "supply" && currentPrice > lines.distalLine) return false

    // Mark indices as used
    for (let j = base.legInIdx; j <= move.endIdx; j++) {
      usedIndices.add(j)
    }

    rawCandidates.push({
      type: zoneType,
      formation,
      instrument,
      proximalLine: lines.proximalLine,
      distalLine: lines.distalLine,
      baseStartIndex: base.startIdx,
      baseEndIndex: base.endIdx,
      baseCandles: base.candles.length,
      legOutStartIndex: move.startIdx,
      legOutEndIndex: move.endIdx,
      legInIndex: base.legInIdx,
    })
    return true
  }

  // ── Pass 1: Leg-first scan (right-to-left) ──────────────────────────────
  // Finds zones where individual candles qualify as classified "leg" candles.
  for (let i = classified.length - 1; i >= config.atrPeriod + 2; i--) {
    if (usedIndices.has(i)) continue

    const c = classified[i]!
    if (c.classification !== "leg") continue

    const direction: "up" | "down" = c.isBullish ? "up" : "down"
    const move = detectExplosiveMove(classified, i, direction, config.minLegCandles)
    if (!move.isExplosive) continue

    const base = findBaseCluster(classified, move.startIdx, config.maxBaseCandles)
    if (!base) continue

    tryAddCandidate(move, base, direction)
  }

  // ── Pass 2: Displacement-based scan (left-to-right) ─────────────────────
  // Catches zones where the move consists of multiple moderate candles that
  // individually don't qualify as "leg" but collectively form a strong move.
  // Scans for base clusters and checks price displacement on either side.
  const MIN_DISPLACEMENT_ATR = 1.5 // Minimum displacement in ATR multiples

  for (let i = config.atrPeriod + 1; i < classified.length - 2; i++) {
    if (usedIndices.has(i)) continue
    const c = classified[i]!
    // Only "base" classified candles can start a cluster
    if (c.classification !== "base") continue

    // Find extent of this base cluster (consecutive "base" candles only)
    let clusterEnd = i
    for (let j = i + 1; j < classified.length && clusterEnd - i + 1 < config.maxBaseCandles; j++) {
      if (usedIndices.has(j)) break
      if (classified[j]!.classification !== "base") break
      clusterEnd = j
    }

    const baseLength = clusterEnd - i + 1
    if (baseLength > config.maxBaseCandles) {
      i = clusterEnd
      continue
    }

    // Need a directional candle BEFORE this cluster (leg-in)
    const legInIdx = i - 1
    if (legInIdx < config.atrPeriod || usedIndices.has(legInIdx)) continue
    const legIn = classified[legInIdx]!
    // Accept any candle with decent body relative to ATR as leg-in
    if (legIn.bodyVsAtr < 0.5 || legIn.bodyRatio < 0.3) continue

    // Need significant price movement AFTER this cluster (leg-out)
    const legOutStart = clusterEnd + 1
    if (legOutStart >= classified.length) continue

    // Measure displacement over 1-5 candles after the cluster
    const localAtr = atrValues[clusterEnd] ?? atrValues[atrValues.length - 1] ?? 0
    if (localAtr === 0) continue
    const minDisplacement = localAtr * MIN_DISPLACEMENT_ATR

    // Collect base candles for this cluster
    const baseCandles = classified.slice(i, clusterEnd + 1)
    const baseHigh = Math.max(...baseCandles.map((bc) => bc.high))
    const baseLow = Math.min(...baseCandles.map((bc) => bc.low))

    // Check upward displacement (rally leg-out → demand zone)
    let maxUpDisp = 0
    let upEndIdx = legOutStart
    for (let j = legOutStart; j < Math.min(legOutStart + 5, classified.length); j++) {
      if (usedIndices.has(j)) break
      const high = classified[j]!.high
      if (high - baseHigh > maxUpDisp) {
        maxUpDisp = high - baseHigh
        upEndIdx = j
      }
    }

    // Check downward displacement (drop leg-out → supply zone)
    let maxDownDisp = 0
    let downEndIdx = legOutStart
    for (let j = legOutStart; j < Math.min(legOutStart + 5, classified.length); j++) {
      if (usedIndices.has(j)) break
      const low = classified[j]!.low
      if (baseLow - low > maxDownDisp) {
        maxDownDisp = baseLow - low
        downEndIdx = j
      }
    }

    // Try the stronger direction
    if (maxUpDisp >= minDisplacement && maxUpDisp >= maxDownDisp) {
      const base = { legInIdx, startIdx: i, endIdx: clusterEnd, candles: baseCandles }
      const move = { startIdx: legOutStart, endIdx: upEndIdx }
      if (tryAddCandidate(move, base, "up")) {
        i = clusterEnd // Skip past this cluster
        continue
      }
    }

    if (maxDownDisp >= minDisplacement && maxDownDisp > maxUpDisp) {
      const base = { legInIdx, startIdx: i, endIdx: clusterEnd, candles: baseCandles }
      const move = { startIdx: legOutStart, endIdx: downEndIdx }
      if (tryAddCandidate(move, base, "down")) {
        i = clusterEnd // Skip past this cluster
        continue
      }
    }
  }

  // Step 6: Score all zones
  // First pass: score strength needs opposing zones, so we do two passes
  const demandCandidates = rawCandidates.filter((z) => z.type === "demand")
  const supplyCandidates = rawCandidates.filter((z) => z.type === "supply")

  const allZones: ZoneData[] = []

  for (const candidate of rawCandidates) {
    const opposing = candidate.type === "demand" ? supplyCandidates : demandCandidates
    const { scores, testCount, penetrationPercent } = scoreZone(
      candidate,
      classified,
      opposing,
      config,
    )

    const { width, widthPips } = computeZoneWidth(
      candidate.proximalLine,
      candidate.distalLine,
      instrument,
    )
    const status = getZoneStatus(
      candidate.type,
      candidate.proximalLine,
      candidate.distalLine,
      currentPrice,
    )

    const distanceFromPrice =
      candidate.type === "demand"
        ? currentPrice - candidate.proximalLine
        : candidate.proximalLine - currentPrice
    const distanceFromPricePips = priceToPips(instrument, distanceFromPrice)

    const ageInCandles = candles.length - 1 - candidate.baseEndIndex

    const zone: ZoneData = {
      id: generateZoneId(
        instrument,
        timeframe,
        candidate.type,
        candles[candidate.baseStartIndex]!.time,
        candles[candidate.baseEndIndex]!.time,
      ),
      type: candidate.type,
      formation: candidate.formation,
      instrument,
      timeframe,
      proximalLine: candidate.proximalLine,
      distalLine: candidate.distalLine,
      width,
      widthPips,
      baseStartTime: candles[candidate.baseStartIndex]!.time,
      baseEndTime: candles[candidate.baseEndIndex]!.time,
      baseCandles: candidate.baseCandles,
      baseStartIndex: candidate.baseStartIndex,
      baseEndIndex: candidate.baseEndIndex,
      scores,
      riskReward: {
        entryPrice: candidate.proximalLine,
        stopLossPrice: candidate.distalLine,
        takeProfitPrice: null,
        riskPips: widthPips,
        rewardPips: null,
        ratio: null,
      },
      status,
      penetrationPercent,
      testCount,
      ageInCandles,
      distanceFromPricePips,
    }

    allZones.push(zone)
  }

  // Compute R:R now that we have all zones
  for (const zone of allZones) {
    zone.riskReward = computeRiskReward(zone, allZones, instrument)
  }

  // Step 7: Deduplicate overlapping same-type zones.
  // When two same-type zones overlap significantly, keep only the higher-scored one.
  // This prevents stacking duplicate zones on top of each other.
  const deduped: ZoneData[] = []
  const sorted = [...allZones].sort(
    (a, b) => b.scores.total - a.scores.total || a.distanceFromPricePips - b.distanceFromPricePips,
  )
  const dropped = new Set<string>()

  for (const zone of sorted) {
    if (dropped.has(zone.id)) continue

    // Check if this zone overlaps with an already-accepted zone of the same type
    const isDuplicate = deduped.some(
      (accepted) => accepted.type === zone.type && zonesOverlap(accepted, zone) > 0.2,
    )
    if (isDuplicate) {
      dropped.add(zone.id)
      continue
    }

    deduped.push(zone)
  }

  // Find nearest demand below and supply above
  const activeDemand = deduped.filter((z) => z.type === "demand" && z.status === "active")
  const activeSupply = deduped.filter((z) => z.type === "supply" && z.status === "active")

  const nearestDemand =
    activeDemand.length > 0
      ? activeDemand.reduce((best, z) =>
          z.distanceFromPricePips < best.distanceFromPricePips ? z : best,
        )
      : null

  const nearestSupply =
    activeSupply.length > 0
      ? activeSupply.reduce((best, z) =>
          z.distanceFromPricePips < best.distanceFromPricePips ? z : best,
        )
      : null

  return {
    instrument,
    timeframe,
    zones: deduped,
    nearestDemand,
    nearestSupply,
    currentPrice,
    candlesAnalyzed: candles.length,
    computedAt: new Date().toISOString(),
  }
}
