// Divergence detection (RSI & MACD) — pure TypeScript, no runtime-specific imports.
import type { Candle } from "./technical-indicators"

/**
 * Divergence classification:
 * - `regular_bullish`: price makes lower low but indicator makes higher low (reversal signal).
 * - `regular_bearish`: price makes higher high but indicator makes lower high (reversal signal).
 * - `hidden_bullish`: price makes higher low but indicator makes lower low (continuation signal).
 * - `hidden_bearish`: price makes lower high but indicator makes higher high (continuation signal).
 */
export type DivergenceType =
  | "regular_bullish"
  | "regular_bearish"
  | "hidden_bullish"
  | "hidden_bearish"

/** A detected divergence between price action and a technical indicator. */
export interface Divergence {
  /** The type of divergence (regular or hidden, bullish or bearish). */
  type: DivergenceType
  /** Which indicator diverged from price. */
  indicator: "rsi" | "macd"
  /** The first (older) price swing point. */
  priceSwing1: { price: number; time: number; index: number }
  /** The second (newer) price swing point. */
  priceSwing2: { price: number; time: number; index: number }
  /** Indicator value at the first swing. */
  indicatorValue1: number
  /** Indicator value at the second swing. */
  indicatorValue2: number
  /** Divergence strength (0-100) based on price distance and indicator difference. */
  strength: number
}

interface Extremum {
  value: number
  price: number
  time: number
  index: number
}

function findExtrema(
  values: number[],
  candles: Candle[],
  str: number,
  mode: "min" | "max",
): Extremum[] {
  const results: Extremum[] = []
  for (let i = str; i < values.length - str; i++) {
    let ok = true
    for (let j = 1; j <= str; j++) {
      const cmp =
        mode === "min"
          ? values[i]! >= values[i - j]! || values[i]! >= values[i + j]!
          : values[i]! <= values[i - j]! || values[i]! <= values[i + j]!
      if (cmp) {
        ok = false
        break
      }
    }
    if (ok) {
      const p = mode === "min" ? candles[i]!.low : candles[i]!.high
      results.push({ value: values[i]!, price: p, time: candles[i]!.time, index: i })
    }
  }
  return results
}

function computeRSISeries(candles: Candle[], period: number): number[] {
  const c = candles.map((x) => x.close)
  const rsi: number[] = new Array(period).fill(50)
  let aG = 0,
    aL = 0
  for (let i = 1; i <= period; i++) {
    const d = c[i]! - c[i - 1]!
    if (d > 0) aG += d
    else aL -= d
  }
  aG /= period
  aL /= period
  rsi.push(aL === 0 ? 100 : 100 - 100 / (1 + aG / aL))
  for (let i = period + 1; i < c.length; i++) {
    const d = c[i]! - c[i - 1]!
    aG = (aG * (period - 1) + (d > 0 ? d : 0)) / period
    aL = (aL * (period - 1) + (d < 0 ? -d : 0)) / period
    rsi.push(aL === 0 ? 100 : 100 - 100 / (1 + aG / aL))
  }
  return rsi
}

function ema(data: number[], p: number): number[] {
  const k = 2 / (p + 1),
    out: number[] = []
  let sum = 0
  for (let i = 0; i < Math.min(p, data.length); i++) {
    sum += data[i]!
    out.push(sum / (i + 1))
  }
  for (let i = p; i < data.length; i++) out.push(data[i]! * k + out[i - 1]! * (1 - k))
  return out
}

function computeMACDHistSeries(candles: Candle[]): number[] {
  const c = candles.map((x) => x.close)
  const macd = ema(c, 12).map((f, i) => f - ema(c, 26)[i]!)
  const sig = ema(macd, 9)
  return macd.map((m, i) => m - sig[i]!)
}

function strength(pDiff: number, iDiff: number, range: number): number {
  if (range === 0) return 0
  return Math.min(
    100,
    Math.max(0, Math.round((Math.abs(pDiff) / range + Math.min(Math.abs(iDiff) / 50, 1)) * 50)),
  )
}

function makeDivergence(
  type: DivergenceType,
  indicator: "rsi" | "macd",
  p1: Extremum,
  p2: Extremum,
  i1: Extremum,
  i2: Extremum,
  str: number,
): Divergence {
  return {
    type,
    indicator,
    strength: str,
    priceSwing1: { price: p1.price, time: p1.time, index: p1.index },
    priceSwing2: { price: p2.price, time: p2.time, index: p2.index },
    indicatorValue1: i1.value,
    indicatorValue2: i2.value,
  }
}

function detect(
  candles: Candle[],
  values: number[],
  ind: "rsi" | "macd",
  sw: number,
): Divergence[] {
  const range = Math.max(...candles.map((c) => c.high)) - Math.min(...candles.map((c) => c.low))
  const pLows = findExtrema(
    candles.map((c) => c.low),
    candles,
    sw,
    "min",
  )
  const pHighs = findExtrema(
    candles.map((c) => c.high),
    candles,
    sw,
    "max",
  )
  const iLows = findExtrema(values, candles, sw, "min")
  const iHighs = findExtrema(values, candles, sw, "max")
  const divs: Divergence[] = []
  const near = (a: Extremum[], idx: number) => a.find((x) => Math.abs(x.index - idx) <= sw)

  for (let i = 0; i < pLows.length - 1; i++) {
    const [p1, p2] = [pLows[i]!, pLows[i + 1]!]
    const [i1, i2] = [near(iLows, p1.index), near(iLows, p2.index)]
    if (!i1 || !i2) continue
    const s = strength(p2.price - p1.price, i2.value - i1.value, range)
    if (p2.price < p1.price && i2.value > i1.value)
      divs.push(makeDivergence("regular_bullish", ind, p1, p2, i1, i2, s))
    else if (p2.price > p1.price && i2.value < i1.value)
      divs.push(makeDivergence("hidden_bullish", ind, p1, p2, i1, i2, s))
  }
  for (let i = 0; i < pHighs.length - 1; i++) {
    const [p1, p2] = [pHighs[i]!, pHighs[i + 1]!]
    const [i1, i2] = [near(iHighs, p1.index), near(iHighs, p2.index)]
    if (!i1 || !i2) continue
    const s = strength(p2.price - p1.price, i2.value - i1.value, range)
    if (p2.price > p1.price && i2.value < i1.value)
      divs.push(makeDivergence("regular_bearish", ind, p1, p2, i1, i2, s))
    else if (p2.price < p1.price && i2.value > i1.value)
      divs.push(makeDivergence("hidden_bearish", ind, p1, p2, i1, i2, s))
  }
  return divs
}

/**
 * Detect divergences between price and RSI (Relative Strength Index).
 * Finds regular and hidden divergences by comparing price swing extremes with RSI extremes.
 *
 * @param candles - OHLCV candle data.
 * @param rsiPeriod - RSI lookback period (default 14).
 * @param swingStrength - Number of bars on each side to confirm a swing point (default 5).
 * @returns Array of detected divergences, empty if insufficient data.
 */
export function detectRSIDivergence(
  candles: Candle[],
  rsiPeriod = 14,
  swingStrength = 5,
): Divergence[] {
  if (candles.length < rsiPeriod + swingStrength * 2 + 1) return []
  return detect(candles, computeRSISeries(candles, rsiPeriod), "rsi", swingStrength)
}

/**
 * Detect divergences between price and MACD histogram.
 * Finds regular and hidden divergences by comparing price swings with MACD histogram extremes.
 *
 * @param candles - OHLCV candle data (requires at least 34 + swingStrength * 2 candles).
 * @param swingStrength - Number of bars on each side to confirm a swing point (default 5).
 * @returns Array of detected divergences, empty if insufficient data.
 */
export function detectMACDDivergence(candles: Candle[], swingStrength = 5): Divergence[] {
  if (candles.length < 34 + swingStrength * 2) return []
  return detect(candles, computeMACDHistSeries(candles), "macd", swingStrength)
}
