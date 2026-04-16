/**
 * SmartFlow scan modes — 4 market analysis strategies that produce trade signals.
 * Each mode analyzes candle data across multiple timeframes and returns scored signals.
 */

import type { SmartFlowScanMode, SmartFlowOpportunityScores } from "@fxflow/types"
import {
  computeATR,
  computeRSI,
  computeEMA,
  computeBollingerBands,
  computeADX,
  detectTrend,
  detectZones,
  detectRegime,
  detectSwingPoints,
  detectRSIDivergence,
  getPipSize,
  getCurrentSession,
  isKillZone,
  DEFAULT_TREND_DETECTION_CONFIG,
  ZONE_PRESETS,
} from "@fxflow/shared"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScanCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface ScanSignal {
  instrument: string
  direction: "long" | "short"
  scanMode: SmartFlowScanMode
  score: number
  scores: SmartFlowOpportunityScores
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPips: number
  rewardPips: number
  riskRewardRatio: number
  regime: string | null
  session: string | null
  reasons: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MIN_CANDLES = 30

/** Add volume:0 to satisfy the Candle interface used by indicator functions. */
function withVolume(candles: ScanCandle[]) {
  return candles.map((c) => ({ ...c, volume: 0 }))
}

function pipDist(a: number, b: number, instrument: string): number {
  return Math.abs(a - b) / getPipSize(instrument)
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

function buildSignal(
  instrument: string,
  direction: "long" | "short",
  scanMode: SmartFlowScanMode,
  entry: number,
  sl: number,
  tp: number,
  scores: SmartFlowOpportunityScores,
  regime: string | null,
  reasons: string[],
): ScanSignal {
  const riskPips = pipDist(entry, sl, instrument)
  const rewardPips = pipDist(entry, tp, instrument)
  const riskRewardRatio = riskPips > 0 ? rewardPips / riskPips : 0
  const session = getCurrentSession()
  return {
    instrument,
    direction,
    scanMode,
    score: scores.total,
    scores,
    entryPrice: entry,
    stopLoss: sl,
    takeProfit: tp,
    riskPips,
    rewardPips,
    riskRewardRatio,
    regime,
    session: session.session,
    reasons,
  }
}

function makeScores(parts: Omit<SmartFlowOpportunityScores, "total">): SmartFlowOpportunityScores {
  const total =
    parts.confluence +
    parts.trendAlignment +
    parts.zoneQuality +
    parts.sessionQuality +
    parts.regimeMatch +
    parts.rrQuality +
    parts.spreadQuality
  return { ...parts, total: clamp(Math.round(total), 0, 100) }
}

// ─── Mode 1: Trend Following ───────────────────────────────────────────────

export function analyzeTrendFollowing(
  instrument: string,
  primaryCandles: ScanCandle[],
  secondaryCandles: ScanCandle[],
  htfCandles: ScanCandle[],
): ScanSignal | null {
  if (primaryCandles.length < MIN_CANDLES || secondaryCandles.length < MIN_CANDLES) return null

  const pv = withVolume(primaryCandles)
  const price = primaryCandles[primaryCandles.length - 1]!.close

  // Detect trend on MTF (secondary) and HTF
  const mtfTrend = detectTrend(
    secondaryCandles,
    instrument,
    "M15",
    DEFAULT_TREND_DETECTION_CONFIG,
    price,
  )
  if (!mtfTrend.direction) return null

  const htfTrend =
    htfCandles.length >= MIN_CANDLES
      ? detectTrend(htfCandles, instrument, "H4", DEFAULT_TREND_DETECTION_CONFIG, price)
      : null
  const htfAligned = htfTrend?.direction === mtfTrend.direction

  // Pullback check: price between EMA 20 and EMA 50
  const ema20 = computeEMA(pv, 20)
  const ema50 = computeEMA(pv, 50)
  if (ema20 === null || ema50 === null) return null

  const isBullish = mtfTrend.direction === "up"
  const inPullback = isBullish ? price <= ema20 && price >= ema50 : price >= ema20 && price <= ema50
  if (!inPullback) return null

  // Pullback confirmation: verify the pullback is ENDING (bouncing), not
  // continuing deeper. Check that the last 3 candles show a reversal toward
  // the trend direction. Without this, entries at the TOP of a pullback
  // (still moving against trend) get stopped out when the pullback deepens.
  if (primaryCandles.length >= 3) {
    const recent3 = primaryCandles.slice(-3)
    const closesRising = recent3.every((c, i) => (i === 0 ? true : c.close > recent3[i - 1]!.close))
    const closesFalling = recent3.every((c, i) =>
      i === 0 ? true : c.close < recent3[i - 1]!.close,
    )
    const bouncing = isBullish ? closesRising : closesFalling
    if (!bouncing) return null // Pullback still deepening — wait
  }

  // RSI in pullback range (40-60)
  const rsi = computeRSI(pv)
  if (rsi === null || rsi < 40 || rsi > 60) return null

  const direction: "long" | "short" = isBullish ? "long" : "short"
  const reasons: string[] = [
    `MTF trend ${mtfTrend.direction}`,
    "Pullback between EMA20/50",
    `RSI ${rsi.toFixed(0)}`,
  ]
  if (htfAligned) reasons.push("HTF trend aligned")

  // SL at last swing low/high, TP at 3x ATR
  const swings = detectSwingPoints(pv, 3)
  const relevantSwings = swings.filter((s) => (isBullish ? s.type === "low" : s.type === "high"))
  const lastSwing = relevantSwings[relevantSwings.length - 1]
  const atrArr = computeATR(primaryCandles, 14)
  const atr = atrArr[atrArr.length - 1] ?? 0
  if (atr === 0) return null

  const sl = lastSwing ? lastSwing.price : isBullish ? price - 1.5 * atr : price + 1.5 * atr
  const tp = isBullish ? price + 3 * atr : price - 3 * atr

  const { regime } = detectRegime(pv)
  const regimeScore = regime === "trending" ? 10 : regime === "ranging" ? 3 : 5

  const scores = makeScores({
    confluence: clamp(
      Math.round((htfAligned ? 20 : 10) + (rsi >= 45 && rsi <= 55 ? 10 : 5)),
      0,
      30,
    ),
    trendAlignment: htfAligned ? 20 : 12,
    zoneQuality: 0,
    sessionQuality: isKillZone() ? 10 : 4,
    regimeMatch: regimeScore,
    rrQuality: clamp(
      Math.round(
        (pipDist(price, tp, instrument) / Math.max(pipDist(price, sl, instrument), 1)) * 3,
      ),
      0,
      10,
    ),
    spreadQuality: 3,
  })

  return buildSignal(
    instrument,
    direction,
    "trend_following",
    price,
    sl,
    tp,
    scores,
    regime,
    reasons,
  )
}

// ─── Mode 2: Mean Reversion ────────────────────────────────────────────────

export function analyzeMeanReversion(
  instrument: string,
  primaryCandles: ScanCandle[],
  _secondaryCandles: ScanCandle[],
  _htfCandles: ScanCandle[],
): ScanSignal | null {
  if (primaryCandles.length < MIN_CANDLES) return null

  const pv = withVolume(primaryCandles)
  const price = primaryCandles[primaryCandles.length - 1]!.close

  const rsi = computeRSI(pv)
  if (rsi === null) return null
  const isOversold = rsi < 30
  const isOverbought = rsi > 70
  if (!isOversold && !isOverbought) return null

  const bb = computeBollingerBands(pv)
  if (!bb) return null
  const atBBExtreme = isOversold ? price <= bb.lower : price >= bb.upper
  if (!atBBExtreme) return null

  // Bollinger bandwidth scoring: narrow bands (squeeze) give better mean-
  // reversion R:R because the range is tight. Already-wide bands (exhausted
  // expansion) signal the mean-reversion move may be over — score lower.
  const atrPreBB = computeATR(primaryCandles, 14)
  const atrVal = atrPreBB[atrPreBB.length - 1] ?? 1
  const bbWidthRatio = bb.bandwidth / Math.max(atrVal, 0.0001)
  // < 1.0 = squeeze (narrow), 1.0-2.0 = normal, > 2.0 = wide (exhausted)
  const bbBandwidthScore = bbWidthRatio < 1.0 ? 15 : bbWidthRatio < 2.0 ? 8 : 3

  // Divergence check
  const divergences = detectRSIDivergence(pv)
  const hasDivergence = divergences.length > 0

  // Zone confluence
  const zones = detectZones(primaryCandles, instrument, "H1", ZONE_PRESETS.standard, price)
  const nearZone = isOversold
    ? zones.zones.some(
        (z: { type: string; proximalLine: number; distalLine: number }) =>
          z.type === "demand" && price <= z.proximalLine && price >= z.distalLine,
      )
    : zones.zones.some(
        (z: { type: string; proximalLine: number; distalLine: number }) =>
          z.type === "supply" && price >= z.proximalLine && price <= z.distalLine,
      )

  const direction: "long" | "short" = isOversold ? "long" : "short"
  const reasons: string[] = [`RSI ${rsi.toFixed(0)} (${isOversold ? "oversold" : "overbought"})`]
  reasons.push(`Price at BB ${isOversold ? "lower" : "upper"} band`)
  if (hasDivergence) reasons.push("RSI divergence detected")
  if (nearZone) reasons.push("Near S/D zone")

  const atrArr = computeATR(primaryCandles, 14)
  const atr = atrArr[atrArr.length - 1] ?? 0
  if (atr === 0) return null

  const sl = isOversold ? bb.lower - atr * 0.5 : bb.upper + atr * 0.5
  const tp = bb.middle

  const { regime } = detectRegime(pv)
  const rsiDepth = isOversold ? (30 - rsi) / 30 : (rsi - 70) / 30

  const scores = makeScores({
    confluence: clamp(
      Math.round((hasDivergence ? 15 : 5) + (nearZone ? 10 : 0) + bbBandwidthScore),
      0,
      30,
    ),
    trendAlignment: 5,
    zoneQuality: nearZone ? 15 : 0,
    sessionQuality: isKillZone() ? 10 : 4,
    regimeMatch: regime === "ranging" ? 10 : regime === "trending" ? 3 : 6,
    rrQuality: clamp(Math.round(rsiDepth * 10), 0, 10),
    spreadQuality: 3,
  })

  return buildSignal(
    instrument,
    direction,
    "mean_reversion",
    price,
    sl,
    tp,
    scores,
    regime,
    reasons,
  )
}

// ─── Mode 3: Breakout ──────────────────────────────────────────────────────

export function analyzeBreakout(
  instrument: string,
  primaryCandles: ScanCandle[],
  _secondaryCandles: ScanCandle[],
  _htfCandles: ScanCandle[],
): ScanSignal | null {
  if (primaryCandles.length < MIN_CANDLES + 50) return null

  const pv = withVolume(primaryCandles)
  const price = primaryCandles[primaryCandles.length - 1]!.close

  const bb = computeBollingerBands(pv)
  if (!bb) return null

  // Squeeze detection: current bandwidth < 50% of 50-period average bandwidth
  const lookback = Math.min(50, primaryCandles.length - 20)
  let bwSum = 0
  let bwCount = 0
  for (let i = primaryCandles.length - lookback; i < primaryCandles.length - 1; i++) {
    const slice = withVolume(primaryCandles.slice(0, i + 1))
    const prevBB = computeBollingerBands(slice)
    if (prevBB) {
      bwSum += prevBB.bandwidth
      bwCount++
    }
  }
  if (bwCount === 0) return null
  const avgBandwidth = bwSum / bwCount
  const isSqueeze = bb.bandwidth < avgBandwidth * 0.5

  // ADX rising and crossing above 20
  const adx = computeADX(pv)
  const prevAdx = computeADX(withVolume(primaryCandles.slice(0, -1)))
  const adxRising = adx && prevAdx && adx.adx > prevAdx.adx && adx.adx > 20

  // Breakout confirmation: close outside BB
  const brokeBullish = price > bb.upper
  const brokeBearish = price < bb.lower
  if (!brokeBullish && !brokeBearish) return null

  const direction: "long" | "short" = brokeBullish ? "long" : "short"
  const reasons: string[] = []
  if (isSqueeze) reasons.push("BB squeeze detected")
  if (adxRising) reasons.push(`ADX rising (${adx!.adx.toFixed(0)})`)
  reasons.push(`Breakout ${brokeBullish ? "above upper" : "below lower"} BB`)

  const atrArr = computeATR(primaryCandles, 14)
  const atr = atrArr[atrArr.length - 1] ?? 0
  if (atr === 0) return null

  const lastCandle = primaryCandles[primaryCandles.length - 1]!
  const candleBody = Math.abs(lastCandle.close - lastCandle.open)
  reasons.push(`Breakout candle body: ${(candleBody / atr).toFixed(1)}x ATR`)

  const sl = bb.middle
  const tp = brokeBullish ? price + 2 * atr : price - 2 * atr

  const { regime } = detectRegime(pv)
  const squeezeScore = isSqueeze ? 15 : 5
  const adxScore = adxRising ? 10 : 3

  const scores = makeScores({
    confluence: clamp(squeezeScore + adxScore, 0, 30),
    trendAlignment: 10,
    zoneQuality: 0,
    sessionQuality: isKillZone() ? 10 : 4,
    regimeMatch: regime === "volatile" ? 10 : regime === "trending" ? 7 : 4,
    rrQuality: clamp(
      Math.round(
        (pipDist(price, tp, instrument) / Math.max(pipDist(price, sl, instrument), 1)) * 3,
      ),
      0,
      10,
    ),
    spreadQuality: 3,
  })

  return buildSignal(instrument, direction, "breakout", price, sl, tp, scores, regime, reasons)
}

// ─── Mode 4: Session Momentum ──────────────────────────────────────────────

export function analyzeSessionMomentum(
  instrument: string,
  primaryCandles: ScanCandle[],
  _secondaryCandles: ScanCandle[],
  _htfCandles: ScanCandle[],
): ScanSignal | null {
  if (primaryCandles.length < MIN_CANDLES) return null
  if (!isKillZone()) return null

  const atrArr = computeATR(primaryCandles, 14)
  const atr = atrArr[atrArr.length - 1] ?? 0
  if (atr === 0) return null

  // Find first large-body candle (> 1x ATR) in recent session candles (last 12)
  const sessionWindow = primaryCandles.slice(-12)
  let impulseCandle: ScanCandle | null = null
  let impulseIdx = -1
  for (let i = 0; i < sessionWindow.length; i++) {
    const c = sessionWindow[i]!
    const body = Math.abs(c.close - c.open)
    if (body > atr) {
      impulseCandle = c
      impulseIdx = i
      break
    }
  }
  if (!impulseCandle || impulseIdx < 0) return null

  const isBullishImpulse = impulseCandle.close > impulseCandle.open
  const impulseSize = Math.abs(impulseCandle.close - impulseCandle.open)

  // Check for pullback to ~50% of the initial move after the impulse
  const postImpulse = sessionWindow.slice(impulseIdx + 1)
  if (postImpulse.length === 0) return null

  const pullbackLevel = isBullishImpulse
    ? impulseCandle.close - impulseSize * 0.5
    : impulseCandle.close + impulseSize * 0.5

  const price = primaryCandles[primaryCandles.length - 1]!.close
  const atPullback = isBullishImpulse
    ? price <= pullbackLevel && price >= impulseCandle.open
    : price >= pullbackLevel && price <= impulseCandle.open
  if (!atPullback) return null

  const direction: "long" | "short" = isBullishImpulse ? "long" : "short"
  const session = getCurrentSession()

  const sessionHigh = Math.max(...sessionWindow.map((c) => c.high))
  const sessionLow = Math.min(...sessionWindow.map((c) => c.low))
  const sl = isBullishImpulse ? sessionLow : sessionHigh
  const tp = isBullishImpulse ? price + impulseSize * 1.5 : price - impulseSize * 1.5

  const reasons = [
    `Impulse candle ${(impulseSize / atr).toFixed(1)}x ATR`,
    `Pullback to ~50% of move`,
    `Session: ${session.session}`,
  ]

  const pv = withVolume(primaryCandles)
  const { regime } = detectRegime(pv)
  const moveSizeScore = clamp(Math.round((impulseSize / atr) * 8), 0, 15)

  const scores = makeScores({
    confluence: clamp(moveSizeScore + 10, 0, 30),
    trendAlignment: 10,
    zoneQuality: 0,
    sessionQuality: 10,
    regimeMatch: regime === "volatile" || regime === "trending" ? 10 : 5,
    rrQuality: clamp(
      Math.round(
        (pipDist(price, tp, instrument) / Math.max(pipDist(price, sl, instrument), 1)) * 3,
      ),
      0,
      10,
    ),
    spreadQuality: 3,
  })

  return buildSignal(
    instrument,
    direction,
    "session_momentum",
    price,
    sl,
    tp,
    scores,
    regime,
    reasons,
  )
}

// ─── Main Export ────────────────────────────────────────────────────────────

const MODE_ANALYZERS: Record<SmartFlowScanMode, typeof analyzeTrendFollowing> = {
  trend_following: analyzeTrendFollowing,
  mean_reversion: analyzeMeanReversion,
  breakout: analyzeBreakout,
  session_momentum: analyzeSessionMomentum,
}

export function analyzeAllModes(
  instrument: string,
  primaryCandles: ScanCandle[],
  secondaryCandles: ScanCandle[],
  htfCandles: ScanCandle[],
  enabledModes: Record<SmartFlowScanMode, boolean>,
): ScanSignal[] {
  const signals: ScanSignal[] = []

  for (const [mode, enabled] of Object.entries(enabledModes) as [SmartFlowScanMode, boolean][]) {
    if (!enabled) continue
    const analyzer = MODE_ANALYZERS[mode]
    try {
      const signal = analyzer(instrument, primaryCandles, secondaryCandles, htfCandles)
      if (signal) signals.push(signal)
    } catch (err) {
      console.log(`[smart-flow-scanner] ${mode} analysis failed for ${instrument}:`, err)
    }
  }

  return signals.sort((a, b) => b.score - a.score)
}
