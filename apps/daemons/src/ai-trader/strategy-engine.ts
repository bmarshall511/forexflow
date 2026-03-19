import type { ZoneCandle, AiTraderProfile, AiTraderTechnique } from "@fxflow/types"
import {
  computeRSI,
  computeMACD,
  computeEMA,
  computeBollingerBands,
  computeWilliamsR,
  computeADX,
  computeStochastic,
  computeATR,
  computeConfluenceScore,
  detectRegime,
  getCurrentSession,
  getSessionScore,
  isKillZone,
  detectSwingPoints,
  detectMarketStructure,
  detectFairValueGaps,
  detectOrderBlocks,
  detectRSIDivergence,
  detectMACDDivergence,
  isInOTEZone,
  findFibonacciFromSwings,
  getPipSize,
  getTypicalSpread,
  priceToPips,
  type Candle,
  type ConfluenceInput,
} from "@fxflow/shared"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TechnicalSnapshot {
  rsi: number | null
  macd: { macdLine: number; signalLine: number; histogram: number } | null
  ema20: number | null
  ema50: number | null
  ema200: number | null
  bollingerBands: { upper: number; middle: number; lower: number; bandwidth: number } | null
  williamsR: number | null
  adx: { adx: number; plusDI: number; minusDI: number } | null
  stochastic: { k: number; d: number } | null
  atr: number | null
  regime: string | null
  session: string | null
  isKillZone: boolean
  // Multi-timeframe fields
  htfEma20: number | null
  htfEma50: number | null
  htfTrendBullish: boolean | null
  secondaryRsi: number | null
  secondaryRegime: string | null
}

export interface Tier1Signal {
  instrument: string
  direction: "long" | "short"
  profile: AiTraderProfile
  confidence: number
  entryPrice: number
  suggestedSL: number
  suggestedTP: number
  riskPips: number
  rewardPips: number
  riskRewardRatio: number
  primaryTechnique: AiTraderTechnique
  technicalSnapshot: TechnicalSnapshot
  confluenceBreakdown: Record<string, { present: boolean; weight: number; contribution: number }>
  reasons: string[]
}

// ─── Candle Conversion ───────────────────────────────────────────────────────

function toCandle(zc: ZoneCandle): Candle {
  return { open: zc.open, high: zc.high, low: zc.low, close: zc.close, time: zc.time, volume: 0 }
}

// ─── Profile Timeframe Config ────────────────────────────────────────────────

interface ProfileConfig {
  scanTimeframes: { primary: string; secondary: string; htf: string }
  candleCounts: { primary: number; secondary: number; htf: number }
  minRR: number
  atrSlMultiplier: number
  atrTpMultiplier: number
}

const PROFILE_CONFIGS: Record<AiTraderProfile, ProfileConfig> = {
  scalper: {
    scanTimeframes: { primary: "M5", secondary: "M15", htf: "H1" },
    candleCounts: { primary: 100, secondary: 50, htf: 50 },
    minRR: 1.5,
    atrSlMultiplier: 1.5,
    atrTpMultiplier: 2.5,
  },
  intraday: {
    scanTimeframes: { primary: "M15", secondary: "H1", htf: "H4" },
    candleCounts: { primary: 100, secondary: 50, htf: 50 },
    minRR: 2.0,
    atrSlMultiplier: 2.0,
    atrTpMultiplier: 4.0,
  },
  swing: {
    scanTimeframes: { primary: "H4", secondary: "D", htf: "W" },
    candleCounts: { primary: 100, secondary: 50, htf: 30 },
    minRR: 2.5,
    atrSlMultiplier: 2.5,
    atrTpMultiplier: 6.0,
  },
  news: {
    scanTimeframes: { primary: "M5", secondary: "M15", htf: "H1" },
    candleCounts: { primary: 80, secondary: 40, htf: 40 },
    minRR: 1.5,
    atrSlMultiplier: 2.0,
    atrTpMultiplier: 3.0,
  },
}

// ─── Filter Diagnostics ─────────────────────────────────────────────────────

export interface Tier1FilterStats {
  lowVolatility: number
  noReasons: number
  lowConfluence: number
  spreadTooWide: number
  rrTooLow: number
  htfPenalized: number
  secondaryRsiPenalized: number
  passed: number
}

// ─── Tier 1 Analysis ─────────────────────────────────────────────────────────

/**
 * Run Tier 1 (free, local) technical analysis on candle data for an instrument.
 * Returns an array of potential signals ranked by confluence score, plus filter diagnostics.
 */
export function analyzeTier1(
  instrument: string,
  primaryCandles: ZoneCandle[],
  secondaryCandles: ZoneCandle[],
  htfCandles: ZoneCandle[],
  profile: AiTraderProfile,
  enabledTechniques: Record<AiTraderTechnique, boolean>,
  filterStats?: Tier1FilterStats,
): Tier1Signal[] {
  if (primaryCandles.length < 30) return []

  const profileConfig = PROFILE_CONFIGS[profile]
  const candles = primaryCandles.map(toCandle)
  const lastPrice = candles[candles.length - 1]!.close
  const pipSize = getPipSize(instrument)

  // ─── Compute primary indicators ──────────────────────────────────
  const rsi = computeRSI(candles, 14)
  const macd = computeMACD(candles)
  const ema20 = computeEMA(candles, 20)
  const ema50 = computeEMA(candles, 50)
  const ema200 = candles.length >= 200 ? computeEMA(candles, 200) : null
  const bb = computeBollingerBands(candles)
  const williamsR = computeWilliamsR(candles, 14)
  const adx = computeADX(candles, 14)
  const stoch = computeStochastic(candles, 14, 3)
  const atrArr = computeATR(primaryCandles, 14)
  const atr = atrArr.length > 0 ? atrArr[atrArr.length - 1]! : null
  const regime = detectRegime(candles)
  const session = getCurrentSession()
  const killZoneActive = isKillZone()
  const sessionScoreVal = getSessionScore(instrument, session.session)

  // ─── Regime gate: reject low-volatility markets ──────────────────
  if (regime.regime === "low_volatility") {
    if (filterStats) filterStats.lowVolatility++
    return []
  }

  // ─── Multi-timeframe analysis ────────────────────────────────────
  const secCandles = secondaryCandles.map(toCandle)
  const htfCandlesMapped = htfCandles.map(toCandle)

  const secondaryRsi = secCandles.length >= 14 ? computeRSI(secCandles, 14) : null
  const secondaryRegimeResult = secCandles.length >= 20 ? detectRegime(secCandles) : null

  const htfEma20 = htfCandlesMapped.length >= 20 ? computeEMA(htfCandlesMapped, 20) : null
  const htfEma50 = htfCandlesMapped.length >= 50 ? computeEMA(htfCandlesMapped, 50) : null
  const htfTrendBullish = htfEma20 !== null && htfEma50 !== null ? htfEma20 > htfEma50 : null

  const snapshot: TechnicalSnapshot = {
    rsi,
    macd,
    ema20,
    ema50,
    ema200,
    bollingerBands: bb
      ? { upper: bb.upper, middle: bb.middle, lower: bb.lower, bandwidth: bb.bandwidth }
      : null,
    williamsR,
    adx,
    stochastic: stoch,
    atr,
    regime: regime.regime,
    session: session.session,
    isKillZone: killZoneActive,
    htfEma20,
    htfEma50,
    htfTrendBullish,
    secondaryRsi,
    secondaryRegime: secondaryRegimeResult?.regime ?? null,
  }

  // ─── SMC analysis ──────────────────────────────────────────────────
  const swings = detectSwingPoints(candles, 5)
  const structure = enabledTechniques.smc_structure ? detectMarketStructure(swings) : []
  const fvgs = enabledTechniques.fair_value_gap ? detectFairValueGaps(candles) : []
  const obs = enabledTechniques.order_block ? detectOrderBlocks(candles, swings) : []

  // ─── Divergence ────────────────────────────────────────────────────
  const rsiDivs = enabledTechniques.divergence ? detectRSIDivergence(candles, 14) : []
  const macdDivs = enabledTechniques.divergence ? detectMACDDivergence(candles) : []

  // ─── Fibonacci ─────────────────────────────────────────────────────
  const fibResult = enabledTechniques.fibonacci_ote ? findFibonacciFromSwings(swings) : null
  const inOTE = fibResult ? isInOTEZone(lastPrice, fibResult) : false

  // ─── Determine direction-specific flags ────────────────────────────
  let smcBias: number | null = null
  if (enabledTechniques.smc_structure && structure.length > 0) {
    const recent = structure[structure.length - 1]!
    smcBias =
      recent.direction === "bullish"
        ? recent.type === "choch"
          ? 90
          : 80
        : recent.type === "choch"
          ? 10
          : 20
  }

  const fvgBull = fvgs.some(
    (f) => f.type === "bullish" && lastPrice <= f.high && lastPrice >= f.low,
  )
  const fvgBear = fvgs.some(
    (f) => f.type === "bearish" && lastPrice >= f.low && lastPrice <= f.high,
  )
  const obBull = obs.some((o) => o.type === "bullish" && lastPrice >= o.low && lastPrice <= o.high)
  const obBear = obs.some((o) => o.type === "bearish" && lastPrice >= o.low && lastPrice <= o.high)

  const emaBull =
    ema20 !== null &&
    ema50 !== null &&
    lastPrice > ema20 &&
    ema20 > ema50 &&
    (ema200 === null || ema50 > ema200)
  const emaBear =
    ema20 !== null &&
    ema50 !== null &&
    lastPrice < ema20 &&
    ema20 < ema50 &&
    (ema200 === null || ema50 < ema200)

  const bullDiv =
    rsiDivs.some((d) => d.type === "regular_bullish" || d.type === "hidden_bullish") ||
    macdDivs.some((d) => d.type === "regular_bullish" || d.type === "hidden_bullish")
  const bearDiv =
    rsiDivs.some((d) => d.type === "regular_bearish" || d.type === "hidden_bearish") ||
    macdDivs.some((d) => d.type === "regular_bearish" || d.type === "hidden_bearish")

  // ─── Build reasons per direction ───────────────────────────────────
  const longReasons: string[] = []
  const shortReasons: string[] = []
  const longTechs: { tech: AiTraderTechnique; str: number }[] = []
  const shortTechs: { tech: AiTraderTechnique; str: number }[] = []

  if (smcBias !== null && smcBias > 50) {
    longReasons.push("Bullish market structure")
    longTechs.push({ tech: "smc_structure", str: 0.9 })
  }
  if (smcBias !== null && smcBias < 50) {
    shortReasons.push("Bearish market structure")
    shortTechs.push({ tech: "smc_structure", str: 0.9 })
  }
  if (fvgBull) {
    longReasons.push("Price in bullish FVG")
    longTechs.push({ tech: "fair_value_gap", str: 0.85 })
  }
  if (fvgBear) {
    shortReasons.push("Price in bearish FVG")
    shortTechs.push({ tech: "fair_value_gap", str: 0.85 })
  }
  if (obBull) {
    longReasons.push("Price at bullish Order Block")
    longTechs.push({ tech: "order_block", str: 0.8 })
  }
  if (obBear) {
    shortReasons.push("Price at bearish Order Block")
    shortTechs.push({ tech: "order_block", str: 0.8 })
  }
  if (inOTE && fibResult) {
    const dir = fibResult.swingHigh > fibResult.swingLow ? "long" : "short"
    if (dir === "long") {
      longReasons.push("Price in Fibonacci OTE zone")
      longTechs.push({ tech: "fibonacci_ote", str: 0.85 })
    } else {
      shortReasons.push("Price in Fibonacci OTE zone")
      shortTechs.push({ tech: "fibonacci_ote", str: 0.85 })
    }
  }
  if (emaBull) {
    longReasons.push("EMA bullish alignment")
    longTechs.push({ tech: "ema_alignment", str: 0.8 })
  }
  if (emaBear) {
    shortReasons.push("EMA bearish alignment")
    shortTechs.push({ tech: "ema_alignment", str: 0.8 })
  }
  if (rsi !== null && rsi < 30) {
    longReasons.push("RSI oversold (" + rsi.toFixed(1) + ")")
    longTechs.push({ tech: "rsi", str: 0.7 })
  }
  if (rsi !== null && rsi > 70) {
    shortReasons.push("RSI overbought (" + rsi.toFixed(1) + ")")
    shortTechs.push({ tech: "rsi", str: 0.7 })
  }
  if (macd && macd.histogram > 0) {
    longReasons.push("MACD bullish")
    longTechs.push({ tech: "macd", str: 0.6 })
  }
  if (macd && macd.histogram < 0) {
    shortReasons.push("MACD bearish")
    shortTechs.push({ tech: "macd", str: 0.6 })
  }
  if (bullDiv) {
    longReasons.push("Bullish divergence")
    longTechs.push({ tech: "divergence", str: 0.75 })
  }
  if (bearDiv) {
    shortReasons.push("Bearish divergence")
    shortTechs.push({ tech: "divergence", str: 0.75 })
  }
  if (bb && lastPrice <= bb.lower) {
    longReasons.push("Price at lower Bollinger Band")
    longTechs.push({ tech: "bollinger_bands", str: 0.6 })
  }
  if (bb && lastPrice >= bb.upper) {
    shortReasons.push("Price at upper Bollinger Band")
    shortTechs.push({ tech: "bollinger_bands", str: 0.6 })
  }
  if (williamsR !== null && williamsR < -80) {
    longReasons.push("Williams %R oversold")
    longTechs.push({ tech: "williams_r", str: 0.5 })
  }
  if (williamsR !== null && williamsR > -20) {
    shortReasons.push("Williams %R overbought")
    shortTechs.push({ tech: "williams_r", str: 0.5 })
  }

  // ─── Generate signals per direction ────────────────────────────────
  const signals: Tier1Signal[] = []

  for (const direction of ["long", "short"] as const) {
    const reasons = direction === "long" ? longReasons : shortReasons
    const techs = direction === "long" ? longTechs : shortTechs
    if (reasons.length < 1) {
      if (filterStats) filterStats.noReasons++
      continue
    }

    // ─── Confidence penalty: HTF trend disagrees (soft gate) ─────
    let htfPenalty = 0
    if (htfTrendBullish !== null) {
      if (direction === "long" && !htfTrendBullish) htfPenalty = 15
      if (direction === "short" && htfTrendBullish) htfPenalty = 15
    }
    if (htfPenalty > 0 && filterStats) filterStats.htfPenalized++

    // ─── Confidence penalty: secondary TF overextended (soft gate) ─
    let secondaryRsiPenalty = 0
    if (secondaryRsi !== null) {
      if (direction === "long" && secondaryRsi > 70) secondaryRsiPenalty = 15
      else if (direction === "long" && secondaryRsi > 60) secondaryRsiPenalty = 8
      if (direction === "short" && secondaryRsi < 30) secondaryRsiPenalty = 15
      else if (direction === "short" && secondaryRsi < 40) secondaryRsiPenalty = 8
    }
    if (secondaryRsiPenalty > 0 && filterStats) filterStats.secondaryRsiPenalized++

    const confluenceInput: ConfluenceInput = {
      smcBias: direction === "long" ? (smcBias ?? null) : smcBias !== null ? 100 - smcBias : null,
      fvgPresent: direction === "long" ? fvgBull : fvgBear,
      orderBlockPresent: direction === "long" ? obBull : obBear,
      inOTEZone: inOTE,
      supplyDemandZone: false,
      trendAligned: direction === "long" ? emaBull : emaBear,
      emaAligned: direction === "long" ? emaBull : emaBear,
      rsiSignal: rsi,
      macdSignal: macd ? macd.histogram : null,
      divergencePresent: direction === "long" ? bullDiv : bearDiv,
      williamsRSignal: williamsR,
      adxValue: adx?.adx ?? null,
      regimeScore: regime.confidence ?? null,
      sessionScore: sessionScoreVal,
    }

    const result = computeConfluenceScore(confluenceInput, direction)
    // Apply penalties as score reduction instead of hard filtering
    const adjustedScore = Math.max(0, result.score - htfPenalty - secondaryRsiPenalty)
    if (adjustedScore < 25) {
      if (filterStats) filterStats.lowConfluence++
      continue
    }

    const atrVal = atr ?? pipSize * 20
    // Widen SL in volatile regimes to avoid noise-triggered stops
    const slMultiplier =
      regime.regime === "volatile"
        ? profileConfig.atrSlMultiplier * 1.5
        : profileConfig.atrSlMultiplier
    const entryPrice = lastPrice
    const sl =
      direction === "long" ? entryPrice - atrVal * slMultiplier : entryPrice + atrVal * slMultiplier
    const tp =
      direction === "long"
        ? entryPrice + atrVal * profileConfig.atrTpMultiplier
        : entryPrice - atrVal * profileConfig.atrTpMultiplier

    const riskPips = priceToPips(instrument, Math.abs(entryPrice - sl))
    const rewardPips = priceToPips(instrument, Math.abs(tp - entryPrice))

    // ─── Spread-aware R:R: reject if spread eats too much risk ─────
    const spreadPips = getTypicalSpread(instrument)
    if (spreadPips > riskPips * 0.3) {
      if (filterStats) filterStats.spreadTooWide++
      continue // Spread > 30% of risk
    }
    const effectiveRisk = riskPips + spreadPips
    const effectiveReward = rewardPips - spreadPips
    const rr = effectiveRisk > 0 ? effectiveReward / effectiveRisk : 0
    if (rr < profileConfig.minRR) {
      if (filterStats) filterStats.rrTooLow++
      continue
    }

    const sorted = [...techs].sort((a, b) => b.str - a.str)
    const primaryTechnique = sorted[0]?.tech ?? "smc_structure"

    if (filterStats) filterStats.passed++

    signals.push({
      instrument,
      direction,
      profile,
      confidence: adjustedScore,
      entryPrice,
      suggestedSL: sl,
      suggestedTP: tp,
      riskPips,
      rewardPips,
      riskRewardRatio: rr,
      primaryTechnique,
      technicalSnapshot: snapshot,
      confluenceBreakdown: result.breakdown,
      reasons,
    })
  }

  signals.sort((a, b) => b.confidence - a.confidence)
  return signals
}

/** Get the candle timeframes needed for a given profile. */
export function getProfileConfig(profile: AiTraderProfile): ProfileConfig {
  return PROFILE_CONFIGS[profile]
}
