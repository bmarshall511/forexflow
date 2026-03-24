export const TIMEFRAME_OPTIONS = [
  { value: "M1", label: "1m" },
  { value: "M5", label: "5m" },
  { value: "M15", label: "15m" },
  { value: "M30", label: "30m" },
  { value: "H1", label: "1H" },
  { value: "H4", label: "4H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
  { value: "M", label: "1M" },
] as const

/**
 * Map a TradingView interval string (e.g., "15", "60", "D") to an OANDA
 * granularity string (e.g., "M15", "H1", "D").
 *
 * Returns "H1" as a safe default for unrecognised intervals.
 */
const TV_INTERVAL_MAP: Record<string, string> = {
  "1": "M1",
  "3": "M5", // TV has 3m, round up to M5
  "5": "M5",
  "15": "M15",
  "30": "M30",
  "45": "H1", // TV has 45m, round up to H1
  "60": "H1",
  "120": "H4", // TV has 2h, round up to H4
  "180": "H4", // TV has 3h, round up to H4
  "240": "H4",
  D: "D",
  "1D": "D",
  W: "W",
  "1W": "W",
  M: "M",
  "1M": "M",
}

export function mapTVIntervalToGranularity(interval: string | undefined): string {
  if (!interval) return "H1"
  return TV_INTERVAL_MAP[interval] ?? "H1"
}

/** How many candles to request for a given granularity (enough for EMA 200 + buffer). */
const CANDLE_COUNTS: Record<string, number> = {
  M1: 250,
  M5: 250,
  M15: 250,
  M30: 250,
  H1: 250,
  H4: 250,
  D: 250,
  W: 250,
  M: 250,
}

export function getCandleCountForGranularity(granularity: string): number {
  return CANDLE_COUNTS[granularity] ?? 250
}
