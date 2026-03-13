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
