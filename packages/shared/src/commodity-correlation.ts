// ─── Commodity Correlation for Trade Finder ──────────────────────────────────
//
// 4 strong correlations used for Odds Enhancer scoring:
//   AUD_USD ↔ XAU_USD (+)  — Gold rallies → AUD rallies
//   USD_CAD ↔ BCO_USD (−)  — Oil rallies → CAD rallies → USD_CAD drops
//   NZD_USD ↔ XAU_USD (+)  — Gold rallies → NZD rallies
//   USD_CHF ↔ XAU_USD (−)  — Gold rallies → CHF rallies → USD_CHF drops

import type { ZoneData, ZoneType } from "@fxflow/types"

export interface CommodityCorrelation {
  /** The forex pair */
  forexPair: string
  /** The correlated commodity instrument */
  commodity: string
  /** +1 = positive correlation, -1 = negative (inverse) */
  direction: 1 | -1
}

/** The 4 strong commodity correlations */
export const COMMODITY_CORRELATIONS: CommodityCorrelation[] = [
  { forexPair: "AUD_USD", commodity: "XAU_USD", direction: 1 },
  { forexPair: "USD_CAD", commodity: "BCO_USD", direction: -1 },
  { forexPair: "NZD_USD", commodity: "XAU_USD", direction: 1 },
  { forexPair: "USD_CHF", commodity: "XAU_USD", direction: -1 },
]

/** All commodity instruments needed for correlation checks */
export const COMMODITY_INSTRUMENTS = ["XAU_USD", "BCO_USD"] as const

/**
 * Get the commodity correlation for a forex pair, or null if none exists.
 */
export function getCorrelation(instrument: string): CommodityCorrelation | null {
  return COMMODITY_CORRELATIONS.find((c) => c.forexPair === instrument) ?? null
}

/**
 * Score commodity correlation (0 or 1).
 *
 * Logic: If the correlated commodity has an active zone in the same
 * directional alignment as the forex pair's setup, score 1.
 *
 * For positive correlation (+1):
 *   - Forex demand zone → commodity should have demand zone (both bullish)
 *   - Forex supply zone → commodity should have supply zone (both bearish)
 *
 * For negative correlation (-1):
 *   - Forex demand zone → commodity should have supply zone (forex bullish when commodity bearish)
 *   - Forex supply zone → commodity should have demand zone (forex bearish when commodity bullish)
 */
export function scoreCommodityCorrelation(
  forexInstrument: string,
  forexZoneType: ZoneType,
  commodityZones: ZoneData[],
): { value: number; aligned: boolean; commodity: string | null } {
  const correlation = getCorrelation(forexInstrument)
  if (!correlation) {
    return { value: 0, aligned: false, commodity: null }
  }

  // Determine what commodity zone type would confirm alignment
  let expectedCommodityType: ZoneType
  if (correlation.direction === 1) {
    // Positive: same direction
    expectedCommodityType = forexZoneType
  } else {
    // Negative: opposite direction
    expectedCommodityType = forexZoneType === "demand" ? "supply" : "demand"
  }

  const hasAlignedZone = commodityZones.some(
    (z) => z.type === expectedCommodityType && z.status === "active",
  )

  return {
    value: hasAlignedZone ? 1 : 0,
    aligned: hasAlignedZone,
    commodity: correlation.commodity,
  }
}
