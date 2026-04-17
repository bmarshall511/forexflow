/**
 * Compound zone detection — identifies when multiple zones cluster at similar price levels.
 *
 * When 2+ zones of the same type form within 0.5x ATR of each other, they represent
 * accumulation (demand) or distribution (supply) patterns. These are higher-probability
 * setups because they show multiple institutional entries at the same level.
 *
 * @module compound-zones
 */
import type { ZoneData } from "@fxflow/types"

/**
 * Detect compound zones by finding clusters of same-type zones at similar prices.
 * Returns the input zones with a `compoundCount` property added to clustered zones.
 *
 * @param zones - Detected zones from zone-detector
 * @param atr - ATR value for proximity threshold
 * @returns Zones with compound bonus metadata
 */
export function detectCompoundZones(
  zones: ZoneData[],
  atr: number,
): (ZoneData & { compoundCount: number })[] {
  if (zones.length < 2 || atr <= 0) {
    return zones.map((z) => ({ ...z, compoundCount: 0 }))
  }

  const proximityThreshold = atr * 0.5
  const result: (ZoneData & { compoundCount: number })[] = zones.map((z) => ({
    ...z,
    compoundCount: 0,
  }))

  // For each zone, count how many other zones of the same type are within proximity
  for (let i = 0; i < result.length; i++) {
    const zone = result[i]!
    let clusterCount = 0

    for (let j = 0; j < result.length; j++) {
      if (i === j) continue
      const other = result[j]!

      // Same type only
      if (other.type !== zone.type) continue

      // Check proximity of proximal lines
      const distance = Math.abs(zone.proximalLine - other.proximalLine)
      if (distance <= proximityThreshold) {
        clusterCount++
      }
    }

    result[i]!.compoundCount = clusterCount
  }

  return result
}

/**
 * Get compound zone scoring bonus (0 or 1).
 * Returns 1 if the zone is part of a compound cluster (2+ zones at similar level).
 */
export function getCompoundBonus(compoundCount: number): number {
  return compoundCount >= 1 ? 1 : 0
}
