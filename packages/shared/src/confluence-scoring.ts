/**
 * Signal confluence scoring — pure functions that evaluate individual
 * technical factors and combine them into a weighted confluence score.
 *
 * Reuses existing indicators from `technical-indicators.ts` and
 * session utilities from `session-utils.ts`. No runtime-specific imports.
 *
 * @module confluence-scoring
 */
import type {
  ConfluenceBreakdown,
  ConfluenceFactorResult,
  ConfluenceResult,
  HTFTrendFactorDetail,
  MomentumFactorDetail,
  SessionFactorDetail,
  TrendFactorDetail,
  TVAlertsQualityConfig,
  TVSignalDirection,
  VolatilityFactorDetail,
} from "@fxflow/types"
import type { Candle } from "./technical-indicators"
import { computeADX, computeEMASeries, computeRSI } from "./technical-indicators"
import { getCurrentSession, getSessionScore, getPairOptimalSessions } from "./session-utils"

// ─── Individual Factor Scoring ──────────────────────────────────────────────

/**
 * Score trend alignment using EMA 50/200.
 *
 * With-trend signals (price above both EMAs + EMA 50 > 200 for buys) score 10.
 * Counter-trend signals score 0. Mixed signals score 3-5.
 */
export function scoreTrend(
  candles: Candle[],
  direction: TVSignalDirection,
): ConfluenceFactorResult<TrendFactorDetail> {
  if (candles.length < 200) {
    return {
      score: 5,
      enabled: true,
      weight: 0,
      detail: { ema50: 0, ema200: 0, price: 0, alignment: "insufficient_data" },
    }
  }

  const ema50Series = computeEMASeries(candles, 50)
  const ema200Series = computeEMASeries(candles, 200)
  const ema50 = ema50Series[ema50Series.length - 1]!
  const ema200 = ema200Series[ema200Series.length - 1]!
  const price = candles[candles.length - 1]!.close

  const isBullishTrend = ema50 > ema200 && price > ema50
  const isBearishTrend = ema50 < ema200 && price < ema50
  const isBullishSignal = direction === "buy"

  let score: number
  let alignment: string

  if (isBullishSignal && isBullishTrend) {
    score = 10
    alignment = "with_trend"
  } else if (!isBullishSignal && isBearishTrend) {
    score = 10
    alignment = "with_trend"
  } else if (isBullishSignal && isBearishTrend) {
    score = 0
    alignment = "against_trend"
  } else if (!isBullishSignal && isBullishTrend) {
    score = 0
    alignment = "against_trend"
  } else {
    // Mixed: price between EMAs or EMAs crossing
    const priceAboveEma200 = price > ema200
    const signalMatchesEma200 = isBullishSignal === priceAboveEma200
    score = signalMatchesEma200 ? 5 : 3
    alignment = "neutral"
  }

  return {
    score,
    enabled: true,
    weight: 0,
    detail: {
      ema50: Math.round(ema50 * 100000) / 100000,
      ema200: Math.round(ema200 * 100000) / 100000,
      price,
      alignment,
    },
  }
}

/**
 * Score momentum using RSI(14).
 *
 * RSI confirming direction (above 50 for buys, below 50 for sells) and not
 * at extremes scores highest. Counter-direction or extreme readings score low.
 */
export function scoreMomentum(
  candles: Candle[],
  direction: TVSignalDirection,
): ConfluenceFactorResult<MomentumFactorDetail> {
  const rsi = computeRSI(candles, 14)
  if (rsi === null) {
    return {
      score: 5,
      enabled: true,
      weight: 0,
      detail: { rsi: 0, zone: "insufficient_data", directionMatch: false },
    }
  }

  const isBuy = direction === "buy"
  let score: number
  let zone: string
  let directionMatch: boolean

  if (rsi >= 80) {
    zone = "overbought"
    directionMatch = false
    score = isBuy ? 1 : 7 // Overbought: bad for buys, decent for sells (reversal)
  } else if (rsi <= 20) {
    zone = "oversold"
    directionMatch = false
    score = isBuy ? 7 : 1 // Oversold: decent for buys (reversal), bad for sells
  } else if (rsi >= 70) {
    zone = "high"
    directionMatch = isBuy
    score = isBuy ? 4 : 6
  } else if (rsi <= 30) {
    zone = "low"
    directionMatch = !isBuy
    score = isBuy ? 6 : 4
  } else if (isBuy && rsi >= 50) {
    zone = "bullish"
    directionMatch = true
    score = rsi >= 55 && rsi <= 65 ? 10 : 8 // Sweet spot: 55-65
  } else if (!isBuy && rsi < 50) {
    zone = "bearish"
    directionMatch = true
    score = rsi >= 35 && rsi <= 45 ? 10 : 8 // Sweet spot: 35-45
  } else {
    // RSI disagrees with direction
    zone = isBuy ? "bearish" : "bullish"
    directionMatch = false
    score = 2
  }

  return {
    score,
    enabled: true,
    weight: 0,
    detail: { rsi: Math.round(rsi * 100) / 100, zone, directionMatch },
  }
}

/**
 * Score volatility regime using ADX(14).
 *
 * ADX ≥ 25 = strong trend (score 10), 20-25 = developing (score 6),
 * < 20 = ranging (score 2). Ranging markets produce the most UT Bot whipsaw.
 */
export function scoreVolatility(candles: Candle[]): ConfluenceFactorResult<VolatilityFactorDetail> {
  const adxResult = computeADX(candles, 14)
  if (!adxResult) {
    return {
      score: 5,
      enabled: true,
      weight: 0,
      detail: { adx: 0, plusDI: 0, minusDI: 0, regime: "insufficient_data" },
    }
  }

  const { adx, plusDI, minusDI } = adxResult
  let score: number
  let regime: string

  if (adx >= 30) {
    score = 10
    regime = "trending"
  } else if (adx >= 25) {
    score = 8
    regime = "trending"
  } else if (adx >= 20) {
    score = 6
    regime = "weak_trend"
  } else if (adx >= 15) {
    score = 3
    regime = "ranging"
  } else {
    score = 1
    regime = "ranging"
  }

  return {
    score,
    enabled: true,
    weight: 0,
    detail: {
      adx: Math.round(adx * 100) / 100,
      plusDI: Math.round(plusDI * 100) / 100,
      minusDI: Math.round(minusDI * 100) / 100,
      regime,
    },
  }
}

/**
 * Score higher-timeframe trend alignment using EMA 50/200.
 *
 * If the higher TF trend matches the signal direction, score 10.
 * Against = 0, neutral = 5.
 */
export function scoreHTFTrend(
  htfCandles: Candle[],
  direction: TVSignalDirection,
  htfTimeframe: string,
): ConfluenceFactorResult<HTFTrendFactorDetail> {
  if (htfCandles.length < 200) {
    return {
      score: 5,
      enabled: true,
      weight: 0,
      detail: { timeframe: htfTimeframe, ema50: 0, ema200: 0, alignment: "insufficient_data" },
    }
  }

  const ema50Series = computeEMASeries(htfCandles, 50)
  const ema200Series = computeEMASeries(htfCandles, 200)
  const ema50 = ema50Series[ema50Series.length - 1]!
  const ema200 = ema200Series[ema200Series.length - 1]!

  const isBullishTrend = ema50 > ema200
  const isBullishSignal = direction === "buy"

  let score: number
  let alignment: string

  if (isBullishSignal === isBullishTrend) {
    score = 10
    alignment = "aligned"
  } else {
    // Check how close the EMAs are (near-cross = neutral rather than against)
    const emaDiff = Math.abs(ema50 - ema200) / ema200
    if (emaDiff < 0.001) {
      score = 5
      alignment = "neutral"
    } else {
      score = 0
      alignment = "against"
    }
  }

  return {
    score,
    enabled: true,
    weight: 0,
    detail: {
      timeframe: htfTimeframe,
      ema50: Math.round(ema50 * 100000) / 100000,
      ema200: Math.round(ema200 * 100000) / 100000,
      alignment,
    },
  }
}

/**
 * Score session quality for the given instrument.
 *
 * Kill zones for pair-relevant sessions score highest. Off-session trading scores low.
 */
export function scoreSession(
  instrument: string,
  timestamp?: Date,
): ConfluenceFactorResult<SessionFactorDetail> {
  const sessionInfo = getCurrentSession(timestamp)
  const sessionScore = getSessionScore(instrument, sessionInfo.session)
  const optimalSessions = getPairOptimalSessions(instrument)
  const isPairOptimal = optimalSessions.includes(sessionInfo.session)

  // Normalize the 10-90 session score to 0-10
  let score: number
  if (sessionInfo.isKillZone && isPairOptimal) {
    score = 10
  } else if (sessionInfo.isKillZone) {
    score = 7
  } else if (sessionScore >= 70) {
    score = 6
  } else if (sessionScore >= 45) {
    score = 4
  } else {
    score = 1
  }

  return {
    score,
    enabled: true,
    weight: 0,
    detail: {
      session: sessionInfo.session as string,
      isKillZone: sessionInfo.isKillZone,
      isPairOptimal,
      sessionScore,
    },
  }
}

// ─── Composite Scoring ──────────────────────────────────────────────────────

/** Configuration for which factors are enabled and their weights. */
interface FactorWeightConfig {
  trend: { enabled: boolean; weight: number }
  momentum: { enabled: boolean; weight: number }
  volatility: { enabled: boolean; weight: number }
  htfTrend: { enabled: boolean; weight: number }
  session: { enabled: boolean; weight: number }
}

/**
 * Calculate a weighted confluence score from individual factor results.
 *
 * Disabled factors are excluded and weights are re-normalized so the total
 * still spans 0-10. If all factors are disabled, returns 10 (pass-through).
 */
export function calculateWeightedScore(
  breakdown: ConfluenceBreakdown,
  weights: FactorWeightConfig,
): number {
  const factors: { score: number; weight: number }[] = []

  if (weights.trend.enabled)
    factors.push({ score: breakdown.trend.score, weight: weights.trend.weight })
  if (weights.momentum.enabled)
    factors.push({ score: breakdown.momentum.score, weight: weights.momentum.weight })
  if (weights.volatility.enabled)
    factors.push({ score: breakdown.volatility.score, weight: weights.volatility.weight })
  if (weights.htfTrend.enabled)
    factors.push({ score: breakdown.htfTrend.score, weight: weights.htfTrend.weight })
  if (weights.session.enabled)
    factors.push({ score: breakdown.session.score, weight: weights.session.weight })

  if (factors.length === 0) return 10 // All disabled = pass-through

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
  if (totalWeight === 0) return 10

  const weightedSum = factors.reduce((sum, f) => sum + f.score * (f.weight / totalWeight), 0)
  return Math.round(weightedSum * 100) / 100
}

/**
 * Build a full ConfluenceResult from quality config and pre-computed factor results.
 */
export function buildConfluenceResult(
  breakdown: ConfluenceBreakdown,
  config: TVAlertsQualityConfig,
  atr: number,
): ConfluenceResult {
  const weights: FactorWeightConfig = {
    trend: { enabled: config.trendFilter, weight: config.trendWeight },
    momentum: { enabled: config.momentumFilter, weight: config.momentumWeight },
    volatility: { enabled: config.volatilityFilter, weight: config.volatilityWeight },
    htfTrend: { enabled: config.htfFilter, weight: config.htfWeight },
    session: { enabled: config.sessionFilter, weight: config.sessionWeight },
  }

  // Stamp enabled/weight from config into each factor result
  breakdown.trend.enabled = config.trendFilter
  breakdown.trend.weight = config.trendWeight
  breakdown.momentum.enabled = config.momentumFilter
  breakdown.momentum.weight = config.momentumWeight
  breakdown.volatility.enabled = config.volatilityFilter
  breakdown.volatility.weight = config.volatilityWeight
  breakdown.htfTrend.enabled = config.htfFilter
  breakdown.htfTrend.weight = config.htfWeight
  breakdown.session.enabled = config.sessionFilter
  breakdown.session.weight = config.sessionWeight

  const score = calculateWeightedScore(breakdown, weights)

  return {
    score,
    breakdown,
    atr,
    passed: score >= config.minScore,
  }
}

// ─── SL/TP Calculation ──────────────────────────────────────────────────────

/**
 * Calculate stop loss price based on ATR.
 *
 * @param entryPrice - Fill price of the trade.
 * @param atr - Current ATR value at signal timeframe.
 * @param direction - Trade direction.
 * @param multiplier - ATR multiplier for SL distance (e.g., 1.5).
 * @returns Stop loss price.
 */
export function calculateATRStopLoss(
  entryPrice: number,
  atr: number,
  direction: TVSignalDirection,
  multiplier: number,
): number {
  const distance = atr * multiplier
  return direction === "buy" ? entryPrice - distance : entryPrice + distance
}

/**
 * Calculate take profit price based on risk:reward ratio.
 *
 * @param entryPrice - Fill price of the trade.
 * @param stopLoss - Stop loss price.
 * @param rrRatio - Risk:reward ratio (e.g., 2.0 for 1:2).
 * @param direction - Trade direction.
 * @returns Take profit price.
 */
export function calculateRRTakeProfit(
  entryPrice: number,
  stopLoss: number,
  rrRatio: number,
  direction: TVSignalDirection,
): number {
  const riskDistance = Math.abs(entryPrice - stopLoss)
  const rewardDistance = riskDistance * rrRatio
  return direction === "buy" ? entryPrice + rewardDistance : entryPrice - rewardDistance
}

// ─── Dynamic Position Sizing ────────────────────────────────────────────────

/**
 * Calculate a position size multiplier based on confluence score and thresholds.
 *
 * @returns Multiplier to apply to base position size (e.g., 1.25 for high confidence).
 */
export function calculateSizeMultiplier(
  score: number,
  config: Pick<
    TVAlertsQualityConfig,
    | "dynamicSizing"
    | "highConfThreshold"
    | "highConfMultiplier"
    | "lowConfThreshold"
    | "lowConfMultiplier"
  >,
): number {
  if (!config.dynamicSizing) return 1.0

  if (score >= config.highConfThreshold) return config.highConfMultiplier
  if (score <= config.lowConfThreshold) return config.lowConfMultiplier
  return 1.0
}
