import { ALL_FOREX_PAIRS } from "./forex-pairs"

/** Set of valid OANDA instrument strings for O(1) lookup */
const VALID_INSTRUMENTS = new Set(ALL_FOREX_PAIRS.map((p) => p.value))

/**
 * Maps a TradingView ticker symbol to OANDA instrument format.
 *
 * Handles common TV formats:
 * - "EURUSD"        → "EUR_USD"  (6-char concatenated)
 * - "FX:EURUSD"     → "EUR_USD"  (exchange prefix stripped)
 * - "OANDA:EUR_USD" → "EUR_USD"  (already correct format with prefix)
 * - "EUR_USD"       → "EUR_USD"  (passthrough)
 * - "EUR/USD"       → "EUR_USD"  (slash-separated)
 *
 * Returns null if the ticker cannot be mapped to a known OANDA instrument.
 */
export function mapTVTickerToOandaInstrument(ticker: string): string | null {
  if (!ticker || typeof ticker !== "string") return null

  let cleaned = ticker.trim().toUpperCase()

  // Strip exchange prefix (e.g., "FX:EURUSD" or "OANDA:EUR_USD")
  const colonIndex = cleaned.indexOf(":")
  if (colonIndex !== -1) {
    cleaned = cleaned.substring(colonIndex + 1)
  }

  // Already in OANDA format (e.g., "EUR_USD")
  if (VALID_INSTRUMENTS.has(cleaned)) {
    return cleaned
  }

  // Slash-separated (e.g., "EUR/USD")
  if (cleaned.includes("/")) {
    const underscored = cleaned.replace("/", "_")
    if (VALID_INSTRUMENTS.has(underscored)) {
      return underscored
    }
  }

  // Concatenated 6-char format (e.g., "EURUSD")
  if (cleaned.length === 6 && !cleaned.includes("_") && !cleaned.includes("/")) {
    const withUnderscore = cleaned.substring(0, 3) + "_" + cleaned.substring(3)
    if (VALID_INSTRUMENTS.has(withUnderscore)) {
      return withUnderscore
    }
  }

  return null
}

/** Check if a string is a valid OANDA instrument */
export function isValidOandaInstrument(instrument: string): boolean {
  return VALID_INSTRUMENTS.has(instrument)
}
