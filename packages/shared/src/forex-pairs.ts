// ─── Curated forex pair list for chart selectors ────────────────────────────

export interface ForexPairGroup {
  label: string
  pairs: { value: string; label: string }[]
}

/** Curated list of forex pairs organized by category */
export const FOREX_PAIR_GROUPS: ForexPairGroup[] = [
  {
    label: "Majors",
    pairs: [
      { value: "EUR_USD", label: "EUR/USD" },
      { value: "GBP_USD", label: "GBP/USD" },
      { value: "USD_JPY", label: "USD/JPY" },
      { value: "USD_CHF", label: "USD/CHF" },
      { value: "AUD_USD", label: "AUD/USD" },
      { value: "NZD_USD", label: "NZD/USD" },
      { value: "USD_CAD", label: "USD/CAD" },
    ],
  },
  {
    label: "Minors",
    pairs: [
      { value: "EUR_GBP", label: "EUR/GBP" },
      { value: "EUR_JPY", label: "EUR/JPY" },
      { value: "GBP_JPY", label: "GBP/JPY" },
      { value: "EUR_AUD", label: "EUR/AUD" },
      { value: "EUR_CHF", label: "EUR/CHF" },
      { value: "GBP_CHF", label: "GBP/CHF" },
      { value: "AUD_NZD", label: "AUD/NZD" },
    ],
  },
  {
    label: "Crosses",
    pairs: [
      { value: "EUR_CAD", label: "EUR/CAD" },
      { value: "EUR_NZD", label: "EUR/NZD" },
      { value: "GBP_AUD", label: "GBP/AUD" },
      { value: "GBP_CAD", label: "GBP/CAD" },
      { value: "GBP_NZD", label: "GBP/NZD" },
      { value: "AUD_CAD", label: "AUD/CAD" },
      { value: "AUD_JPY", label: "AUD/JPY" },
      { value: "CAD_JPY", label: "CAD/JPY" },
      { value: "CHF_JPY", label: "CHF/JPY" },
      { value: "NZD_JPY", label: "NZD/JPY" },
      { value: "NZD_CAD", label: "NZD/CAD" },
      { value: "AUD_CHF", label: "AUD/CHF" },
      { value: "CAD_CHF", label: "CAD/CHF" },
      { value: "NZD_CHF", label: "NZD/CHF" },
    ],
  },
]

/** Flat list of all forex pairs for quick lookups */
export const ALL_FOREX_PAIRS = FOREX_PAIR_GROUPS.flatMap((g) => g.pairs)

/** Convert OANDA instrument format to display format: "EUR_USD" → "EUR/USD" */
export function formatInstrument(instrument: string): string {
  return instrument.replace("_", "/")
}

// ─── Typical spreads (pips) for R:R validation ──────────────────────────────

const TYPICAL_SPREADS: Record<string, number> = {
  // Majors (tight spreads)
  EUR_USD: 1.0,
  GBP_USD: 1.2,
  USD_JPY: 1.0,
  USD_CHF: 1.3,
  AUD_USD: 1.2,
  NZD_USD: 1.5,
  USD_CAD: 1.3,
  // Minors (moderate spreads)
  EUR_GBP: 1.5,
  EUR_JPY: 1.8,
  GBP_JPY: 2.5,
  EUR_AUD: 2.0,
  EUR_CHF: 1.8,
  GBP_CHF: 3.0,
  AUD_NZD: 2.5,
  // Crosses (wider spreads)
  EUR_CAD: 2.5,
  EUR_NZD: 3.0,
  GBP_AUD: 3.0,
  GBP_CAD: 3.0,
  GBP_NZD: 3.5,
  AUD_CAD: 2.5,
  AUD_JPY: 2.0,
  CAD_JPY: 2.0,
  CHF_JPY: 2.5,
  NZD_JPY: 2.5,
  NZD_CAD: 3.0,
  AUD_CHF: 2.5,
  CAD_CHF: 2.5,
  NZD_CHF: 3.0,
}

/** Default spread for unknown pairs */
const DEFAULT_SPREAD_PIPS = 3.0

/** Get typical spread in pips for an instrument. Used for spread-aware R:R filtering. */
export function getTypicalSpread(instrument: string): number {
  return TYPICAL_SPREADS[instrument] ?? DEFAULT_SPREAD_PIPS
}
