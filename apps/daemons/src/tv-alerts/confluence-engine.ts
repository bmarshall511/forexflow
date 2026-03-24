/**
 * Confluence Engine — evaluates incoming TV alert signals against multiple
 * technical factors (trend, momentum, volatility, HTF, session) and calculates
 * ATR-based SL/TP and dynamic position sizing.
 *
 * Orchestrates shared scoring functions (packages/shared) with OANDA candle data
 * via the existing CandleCache infrastructure.
 *
 * @module confluence-engine
 */
import type {
  ConfluenceBreakdown,
  ConfluenceResult,
  TVAlertsQualityConfig,
  TVSignalDirection,
} from "@fxflow/types"
import type { Candle } from "@fxflow/shared"
import {
  buildConfluenceResult,
  calculateATRStopLoss,
  calculateRRTakeProfit,
  calculateSizeMultiplier,
  getCandleCountForGranularity,
  mapTVIntervalToGranularity,
  scoreHTFTrend,
  scoreMomentum,
  scoreSession,
  scoreTrend,
  scoreVolatility,
} from "@fxflow/shared"
import { getHigherTimeframe } from "@fxflow/shared"
import { computeATR } from "@fxflow/shared"
import { CandleCache, fetchOandaCandles } from "../trade-finder/candle-cache.js"
import type { StateManager } from "../state-manager.js"
import { getRestUrl } from "../oanda/api-client.js"

// ZoneCandle lacks `volume` — our scoring functions use Candle which requires it.
// UT Bot doesn't use volume, so we shim it with 0.
function toCandles(
  zoneCandles: Array<{ time: number; open: number; high: number; low: number; close: number }>,
): Candle[] {
  return zoneCandles.map((c) => ({ ...c, volume: 0 }))
}

export interface SLTPResult {
  stopLoss: number | null
  takeProfit: number | null
}

export class ConfluenceEngine {
  private cache = new CandleCache()

  constructor(private stateManager: StateManager) {}

  /**
   * Evaluate confluence for a signal. Returns the score, breakdown, and ATR.
   *
   * @param instrument - OANDA instrument (e.g., "EUR_USD")
   * @param direction - Signal direction ("buy" | "sell")
   * @param tvInterval - TradingView interval string (e.g., "15", "60", "D")
   * @param config - Quality config from DB
   */
  async evaluate(
    instrument: string,
    direction: TVSignalDirection,
    tvInterval: string | undefined,
    config: TVAlertsQualityConfig,
  ): Promise<ConfluenceResult> {
    const granularity = mapTVIntervalToGranularity(tvInterval)
    const count = getCandleCountForGranularity(granularity)
    const htfGranularity = getHigherTimeframe(granularity)

    // Fetch candles in parallel: signal TF + higher TF
    const creds = this.stateManager.getCredentials()
    if (!creds) {
      // No credentials — can't fetch candles, return neutral score
      return this.neutralResult(config)
    }

    const apiUrl = getRestUrl(creds.mode)
    const [signalCandles, htfCandles] = await Promise.all([
      fetchOandaCandles(instrument, granularity, count, apiUrl, creds.token, this.cache),
      htfGranularity
        ? fetchOandaCandles(instrument, htfGranularity, count, apiUrl, creds.token, this.cache)
        : Promise.resolve([]),
    ])

    if (signalCandles.length === 0) {
      return this.neutralResult(config)
    }

    const candles = toCandles(signalCandles)
    const htfCandlesTyped = toCandles(htfCandles)

    // Compute ATR from signal-timeframe candles
    const atrSeries = computeATR(signalCandles, 14)
    const atr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1]! : 0

    // Score each factor
    const breakdown: ConfluenceBreakdown = {
      trend: scoreTrend(candles, direction),
      momentum: scoreMomentum(candles, direction),
      volatility: scoreVolatility(candles),
      htfTrend: scoreHTFTrend(htfCandlesTyped, direction, htfGranularity ?? granularity),
      session: scoreSession(instrument),
    }

    return buildConfluenceResult(breakdown, config, atr)
  }

  /**
   * Calculate SL/TP based on ATR and config.
   */
  calculateSLTP(
    entryPrice: number,
    atr: number,
    direction: TVSignalDirection,
    config: TVAlertsQualityConfig,
  ): SLTPResult {
    let stopLoss: number | null = null
    let takeProfit: number | null = null

    if (config.autoSL && atr > 0) {
      stopLoss = calculateATRStopLoss(entryPrice, atr, direction, config.slAtrMultiplier)
    }

    if (config.autoTP && stopLoss !== null) {
      takeProfit = calculateRRTakeProfit(entryPrice, stopLoss, config.tpRiskRewardRatio, direction)
    }

    return { stopLoss, takeProfit }
  }

  /**
   * Calculate position size multiplier from confluence score.
   */
  getSizeMultiplier(score: number, config: TVAlertsQualityConfig): number {
    return calculateSizeMultiplier(score, config)
  }

  /** Return a neutral/pass-through result when evaluation can't run. */
  private neutralResult(config: TVAlertsQualityConfig): ConfluenceResult {
    const neutralFactor = <D>(detail: D) => ({
      score: 5 as number,
      enabled: true,
      weight: 0,
      detail,
    })

    const breakdown: ConfluenceBreakdown = {
      trend: neutralFactor({ ema50: 0, ema200: 0, price: 0, alignment: "unavailable" }),
      momentum: neutralFactor({ rsi: 0, zone: "unavailable", directionMatch: false }),
      volatility: neutralFactor({ adx: 0, plusDI: 0, minusDI: 0, regime: "unavailable" }),
      htfTrend: neutralFactor({ timeframe: "N/A", ema50: 0, ema200: 0, alignment: "unavailable" }),
      session: neutralFactor({
        session: "unknown",
        isKillZone: false,
        isPairOptimal: false,
        sessionScore: 0,
      }),
    }

    return buildConfluenceResult(breakdown, config, 0)
  }
}
