// @fxflow/shared — shared utilities (pure TS, no framework runtime imports)

export {
  getETOffsetHours,
  toET,
  getETCalendarDate,
  isWeekendClosed,
  isRolloverWindow,
  isMarketExpectedOpen,
  getNextExpectedChange,
  formatCountdown,
  formatMarketDateTime,
  formatShortDateTime,
} from "./market-hours"

export {
  getForexDayStart,
  getForexWeekStart,
  getForexMonthStart,
  getForexYearStart,
  getForexPeriodBoundaries,
  getLastTradingSessionStart,
  type ForexPeriodBoundaries,
} from "./forex-trading-day"

export {
  formatCurrency,
  formatPnL,
  formatRelativeTime,
  type FormattedPnL,
  type PnLColorIntent,
} from "./format-currency"

export {
  getPipSize,
  getDecimalPlaces,
  priceToPips,
  calculateDistanceInfo,
  calculateRiskReward,
  formatPips,
  getTradeOutcome,
  formatDuration,
  type RiskRewardResult,
} from "./pip-utils"

export { TIMEFRAME_OPTIONS } from "./timeframe-utils"

export {
  FOREX_PAIR_GROUPS,
  ALL_FOREX_PAIRS,
  formatInstrument,
  getTypicalSpread,
  type ForexPairGroup,
} from "./forex-pairs"

export { mapTVTickerToOandaInstrument, isValidOandaInstrument } from "./ticker-mapping"

export { detectZones } from "./zone-detector"
export {
  scoreZone,
  scoreZoneExtended,
  type RawZoneCandidate,
  type ExtendedScoringContext,
} from "./zone-scorer"
export {
  computeATR,
  classifyCandles,
  detectExplosiveMove,
  findBaseCluster,
  getHigherTimeframe,
  computeZoneWidth,
  computeFreshness,
  getZoneStatus,
} from "./zone-utils"
export { ZONE_PRESETS, DEFAULT_ZONE_DISPLAY_SETTINGS, getPresetConfig } from "./zone-presets"

export {
  COMMODITY_CORRELATIONS,
  COMMODITY_INSTRUMENTS,
  getCorrelation,
  scoreCommodityCorrelation,
  type CommodityCorrelation,
} from "./commodity-correlation"

export {
  computeRSI,
  computeMACD,
  computeEMA,
  computeEMASeries,
  computeBollingerBands,
  computeWilliamsR,
  computeADX,
  computeStochastic,
  type Candle,
  type MACDResult,
  type BollingerBandsResult,
  type ADXResult,
  type StochasticResult,
} from "./technical-indicators"

export { detectTrend } from "./trend-detector"
export {
  DEFAULT_TREND_DISPLAY_SETTINGS,
  DEFAULT_TREND_VISUAL_SETTINGS,
  DEFAULT_TREND_DETECTION_CONFIG,
  getDefaultSwingStrength,
} from "./trend-defaults"

export {
  FIBONACCI_LEVELS,
  FIBONACCI_EXTENSIONS,
  computeFibonacciRetracement,
  isInOTEZone,
  findFibonacciFromSwings,
  type FibonacciLevel,
  type FibonacciResult,
} from "./fibonacci-calculator"
export type { SwingPoint } from "./fibonacci-calculator"

export {
  detectRSIDivergence,
  detectMACDDivergence,
  type DivergenceType,
  type Divergence,
} from "./divergence-detector"

export {
  getCurrentSession,
  getSessionForTime,
  isKillZone,
  isAutoTradeSession,
  getSessionBestPairs,
  getPairOptimalSessions,
  getSessionScore,
  type ForexSession,
  type SessionInfo,
} from "./session-utils"

export { detectRegime, type MarketRegime, type RegimeResult } from "./regime-detector"

export {
  computeConfluenceScore,
  type ConfluenceInput,
  type ConfluenceResult,
} from "./confluence-scorer"

export {
  detectSwingPoints,
  detectMarketStructure,
  detectFairValueGaps,
  detectOrderBlocks,
  detectLiquiditySweeps,
  detectEqualLevels,
  type SwingPoint as SmcSwingPoint,
  type MarketStructureEvent,
  type FairValueGap,
  type OrderBlock,
  type LiquiditySweep,
  type EqualLevel,
} from "./smc-detector"

export {
  FxFlowError,
  OandaApiError,
  DbError,
  SignalError,
  AiError,
  ValidationError,
} from "./errors"

export {
  extractPriceFromParams,
  extractPriceFromText,
  extractUnitsFromParams,
  priceMatch,
} from "./ai-param-utils"

export {
  getAnalysisStatusConfig,
  isStuckAnalysis,
  MODEL_LABELS,
  DEPTH_LABELS,
  type AnalysisStatusConfig,
} from "./ai-status-utils"

export { Logger } from "./logger"

export {
  resolveDeploymentConfig,
  LOCAL_DEFAULTS,
  type DeploymentMode,
  type DeploymentConfig,
} from "./deployment"

export { parseFrontmatter, slugify, type DocFrontmatter } from "./markdown"

export { classifyAiError, type AiErrorCategory, type ClassifiedAiError } from "./ai-errors"

export { findNearbyKeyLevels, scoreKeyLevels, type KeyLevel } from "./key-levels"
