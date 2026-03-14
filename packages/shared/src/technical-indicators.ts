// Technical indicators — pure TypeScript, no runtime-specific imports.
// ATR lives in ./zone-utils.ts (computeATR) — not duplicated here.

// ─── Types ──────────────────────────────────────────────────────────────────

/** OHLCV candle data used as input for all technical indicator calculations. */
export interface Candle {
  /** Unix timestamp in seconds. */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Result of MACD (Moving Average Convergence Divergence) computation. */
export interface MACDResult {
  /** Fast EMA minus slow EMA. */
  macdLine: number
  /** EMA of the MACD line. */
  signalLine: number
  /** MACD line minus signal line; positive = bullish momentum. */
  histogram: number
}

/** Result of Bollinger Bands computation. */
export interface BollingerBandsResult {
  /** Upper band (middle + stdDev * multiplier). */
  upper: number
  /** Middle band (SMA). */
  middle: number
  /** Lower band (middle - stdDev * multiplier). */
  lower: number
  /** Band width as a ratio: (upper - lower) / middle. Higher values indicate greater volatility. */
  bandwidth: number
  /** %B indicator: (close - lower) / (upper - lower). Values above 1 = price above upper band. */
  percentB: number
}

/** Result of ADX (Average Directional Index) computation measuring trend strength. */
export interface ADXResult {
  /** ADX value (0-100). Above 25 = trending, below 20 = ranging. */
  adx: number
  /** +DI (positive directional indicator). When > -DI, bullish pressure dominates. */
  plusDI: number
  /** -DI (negative directional indicator). When > +DI, bearish pressure dominates. */
  minusDI: number
}

/** Result of Stochastic Oscillator computation measuring momentum. */
export interface StochasticResult {
  /** %K (fast line): current close relative to the high-low range over the lookback period (0-100). */
  k: number
  /** %D (slow line): SMA of %K values. Crossovers signal momentum shifts. */
  d: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close)
}

// ─── EMA ────────────────────────────────────────────────────────────────────

/** Full EMA series over close prices. Returns array same length as input. */
export function computeEMASeries(candles: Candle[], period: number): number[] {
  const data = closes(candles)
  if (data.length === 0 || period < 1) return []
  return emaSeries(data, period)
}

/** Latest EMA value, or null if not enough data. */
export function computeEMA(candles: Candle[], period: number): number | null {
  if (candles.length < period) return null
  const series = computeEMASeries(candles, period)
  return series[series.length - 1] ?? null
}

function emaSeries(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  // Seed with SMA of first `period` values
  let sum = 0
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i]!
    result.push(sum / (i + 1)) // partial SMA until we reach period
  }
  // Apply EMA from period onward
  for (let i = period; i < data.length; i++) {
    const prev = result[i - 1]!
    result.push(data[i]! * k + prev * (1 - k))
  }
  return result
}

// ─── RSI (Wilder's Smoothing) ───────────────────────────────────────────────

/**
 * Compute the Relative Strength Index using Wilder's smoothing method.
 * RSI measures momentum on a 0-100 scale: above 70 = overbought, below 30 = oversold.
 *
 * @param candles - OHLCV candle data.
 * @param period - Lookback period (default 14).
 * @returns Latest RSI value, or null if insufficient data.
 */
export function computeRSI(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const data = closes(candles)

  let avgGain = 0
  let avgLoss = 0

  // Initial averages over first `period` changes
  for (let i = 1; i <= period; i++) {
    const delta = data[i]! - data[i - 1]!
    if (delta > 0) avgGain += delta
    else avgLoss += Math.abs(delta)
  }
  avgGain /= period
  avgLoss /= period

  // Wilder's smoothing for remaining data
  for (let i = period + 1; i < data.length; i++) {
    const delta = data[i]! - data[i - 1]!
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? Math.abs(delta) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ─── MACD ───────────────────────────────────────────────────────────────────

/**
 * Compute MACD (Moving Average Convergence Divergence).
 * A trend-following momentum indicator that shows the relationship between two EMAs.
 *
 * @param candles - OHLCV candle data.
 * @param fast - Fast EMA period (default 12).
 * @param slow - Slow EMA period (default 26).
 * @param signal - Signal line EMA period (default 9).
 * @returns Latest MACD result with line, signal, and histogram values, or null if insufficient data.
 */
export function computeMACD(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDResult | null {
  if (candles.length < slow + signal - 1) return null

  const fastEma = emaSeries(closes(candles), fast)
  const slowEma = emaSeries(closes(candles), slow)

  // MACD line = fast EMA - slow EMA
  const macdLine: number[] = []
  for (let i = 0; i < candles.length; i++) {
    macdLine.push(fastEma[i]! - slowEma[i]!)
  }

  // Signal line = EMA of MACD line
  const signalSeries = emaSeries(macdLine, signal)
  const last = macdLine.length - 1
  const macd = macdLine[last]!
  const sig = signalSeries[last]!
  return { macdLine: macd, signalLine: sig, histogram: macd - sig }
}

// ─── Bollinger Bands ────────────────────────────────────────────────────────

/**
 * Compute Bollinger Bands: a volatility envelope around a simple moving average.
 * Price touching the upper/lower band suggests overbought/oversold conditions.
 *
 * @param candles - OHLCV candle data.
 * @param period - SMA lookback period (default 20).
 * @param stdDevMultiplier - Number of standard deviations for the bands (default 2.0).
 * @returns Band levels with bandwidth and %B, or null if insufficient data.
 */
export function computeBollingerBands(
  candles: Candle[],
  period = 20,
  stdDevMultiplier = 2.0,
): BollingerBandsResult | null {
  if (candles.length < period) return null
  const data = closes(candles)
  const slice = data.slice(-period)

  const middle = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((sum, v) => sum + (v - middle) ** 2, 0) / period
  const stdDev = Math.sqrt(variance)

  const upper = middle + stdDevMultiplier * stdDev
  const lower = middle - stdDevMultiplier * stdDev
  const bandwidth = middle !== 0 ? (upper - lower) / middle : 0
  const range = upper - lower
  const currentClose = data[data.length - 1]!
  const percentB = range !== 0 ? (currentClose - lower) / range : 0.5

  return { upper, middle, lower, bandwidth, percentB }
}

// ─── Williams %R ────────────────────────────────────────────────────────────

/**
 * Compute Williams %R, a momentum oscillator ranging from -100 to 0.
 * Values below -80 indicate oversold, above -20 indicate overbought.
 *
 * @param candles - OHLCV candle data.
 * @param period - Lookback period (default 14).
 * @returns Williams %R value (-100 to 0), or null if insufficient data.
 */
export function computeWilliamsR(candles: Candle[], period = 14): number | null {
  if (candles.length < period) return null
  const slice = candles.slice(-period)
  const highestHigh = Math.max(...slice.map((c) => c.high))
  const lowestLow = Math.min(...slice.map((c) => c.low))
  const close = candles[candles.length - 1]!.close

  const range = highestHigh - lowestLow
  if (range === 0) return -50
  return ((highestHigh - close) / range) * -100
}

// ─── ADX ────────────────────────────────────────────────────────────────────

/**
 * Compute the Average Directional Index (ADX) with directional indicators (+DI/-DI).
 * ADX measures trend strength regardless of direction. Uses Wilder's smoothing.
 *
 * @param candles - OHLCV candle data (requires at least period * 2 candles).
 * @param period - Lookback period (default 14).
 * @returns ADX value with +DI and -DI, or null if insufficient data.
 */
export function computeADX(candles: Candle[], period = 14): ADXResult | null {
  if (candles.length < period * 2) return null

  const n = candles.length
  const tr: number[] = [candles[0]!.high - candles[0]!.low]
  const plusDM: number[] = [0]
  const minusDM: number[] = [0]

  for (let i = 1; i < n; i++) {
    const c = candles[i]!
    const p = candles[i - 1]!
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
    const upMove = c.high - p.high
    const downMove = p.low - c.low
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  // Wilder's smoothing
  const smooth = (arr: number[]): number[] => {
    const out: number[] = []
    let sum = 0
    for (let i = 0; i < period; i++) sum += arr[i]!
    out.push(sum)
    for (let i = period; i < arr.length; i++) {
      out.push(out[out.length - 1]! - out[out.length - 1]! / period + arr[i]!)
    }
    return out
  }

  const smoothTR = smooth(tr)
  const smoothPlusDM = smooth(plusDM)
  const smoothMinusDM = smooth(minusDM)

  // DI series (starts at index 0, corresponding to candle index period-1)
  const dx: number[] = []
  let lastPlusDI = 0
  let lastMinusDI = 0
  for (let i = 0; i < smoothTR.length; i++) {
    const atr = smoothTR[i]!
    const pdi = atr !== 0 ? (smoothPlusDM[i]! / atr) * 100 : 0
    const mdi = atr !== 0 ? (smoothMinusDM[i]! / atr) * 100 : 0
    const diSum = pdi + mdi
    dx.push(diSum !== 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0)
    lastPlusDI = pdi
    lastMinusDI = mdi
  }

  if (dx.length < period) return null

  // ADX = Wilder's smoothed DX
  let adx = 0
  for (let i = 0; i < period; i++) adx += dx[i]!
  adx /= period
  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]!) / period
  }

  return { adx, plusDI: lastPlusDI, minusDI: lastMinusDI }
}

// ─── Stochastic Oscillator ──────────────────────────────────────────────────

/**
 * Compute the Stochastic Oscillator (%K and %D).
 * Compares the closing price to the high-low range over a lookback period.
 * Above 80 = overbought, below 20 = oversold. %K/%D crossovers signal entries.
 *
 * @param candles - OHLCV candle data.
 * @param kPeriod - %K lookback period (default 14).
 * @param dPeriod - %D smoothing period, SMA of %K (default 3).
 * @returns %K and %D values (0-100), or null if insufficient data.
 */
export function computeStochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3,
): StochasticResult | null {
  if (candles.length < kPeriod + dPeriod - 1) return null

  const kValues: number[] = []
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1)
    const highestHigh = Math.max(...slice.map((c) => c.high))
    const lowestLow = Math.min(...slice.map((c) => c.low))
    const range = highestHigh - lowestLow
    kValues.push(range !== 0 ? ((candles[i]!.close - lowestLow) / range) * 100 : 50)
  }

  // %D = SMA of last dPeriod %K values
  const recentK = kValues.slice(-dPeriod)
  const d = recentK.reduce((a, b) => a + b, 0) / dPeriod

  return { k: kValues[kValues.length - 1]!, d }
}
