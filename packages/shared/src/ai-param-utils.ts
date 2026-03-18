/**
 * Shared utilities for extracting values from AI action parameters.
 * Claude uses many different key names for the same concept — these functions
 * consolidate the lookup logic that was previously duplicated 3x in the UI.
 */

const PRICE_KEYS = [
  "price",
  "takeProfit",
  "stopLoss",
  "tp",
  "sl",
  "targetPrice",
  "target",
  "newStopLoss",
  "newTakeProfit",
  "newPrice",
  "entryPrice",
  "partialTakeProfit",
  "triggerPrice",
  "stop",
] as const

const UNITS_KEYS = ["units", "amount", "quantity", "size", "volume"] as const

/** Extract a price from action params — Claude uses many different key names. */
export function extractPriceFromParams(params: Record<string, unknown>): number | undefined {
  for (const key of PRICE_KEYS) {
    const val = params[key]
    if (typeof val === "number" && val > 0) return val
  }
  // Check nested params
  const nested = params.p ?? params.params
  if (nested && typeof nested === "object" && nested !== null) {
    return extractPriceFromParams(nested as Record<string, unknown>)
  }
  return undefined
}

/** Extract a price from action label/description text via regex. */
export function extractPriceFromText(label: string, description?: string): number | undefined {
  const text = `${label} ${description ?? ""}`
  const match = text.match(/\b(\d+\.\d{3,5})\b/)
  return match?.[1] ? parseFloat(match[1]) : undefined
}

/** Extract units from action params. */
export function extractUnitsFromParams(
  params: Record<string, unknown>,
  fallbackTotal?: number,
): number | undefined {
  for (const key of UNITS_KEYS) {
    const val = params[key]
    if (typeof val === "number" && val > 0) return val
  }
  // Handle percentage-based sizing
  const pct = params.percent ?? params.percentage
  if (typeof pct === "number" && pct > 0 && pct <= 100 && fallbackTotal) {
    return Math.round(fallbackTotal * (pct / 100))
  }
  return undefined
}

/** Compare two prices with tolerance (default suitable for forex). */
export function priceMatch(a: number, b: number, tolerance = 0.00015): boolean {
  return Math.abs(a - b) < tolerance
}
