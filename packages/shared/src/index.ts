// @fxflow/shared — shared utilities (pure TS, no framework runtime imports)

export {
  getETOffsetHours,
  toET,
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
  type ForexPairGroup,
} from "./forex-pairs"

export {
  mapTVTickerToOandaInstrument,
  isValidOandaInstrument,
} from "./ticker-mapping"

export { detectZones } from "./zone-detector"
export { scoreZone, scoreZoneExtended, type RawZoneCandidate, type ExtendedScoringContext } from "./zone-scorer"
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

export { detectTrend } from "./trend-detector"
export {
  DEFAULT_TREND_DISPLAY_SETTINGS,
  DEFAULT_TREND_VISUAL_SETTINGS,
  DEFAULT_TREND_DETECTION_CONFIG,
  getDefaultSwingStrength,
} from "./trend-defaults"
