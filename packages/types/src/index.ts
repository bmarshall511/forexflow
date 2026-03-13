// @fxflow/types — shared type contracts

// ─── Trading Mode ────────────────────────────────────────────────────────────

export type TradingMode = "live" | "practice"

// ─── OANDA Settings ──────────────────────────────────────────────────────────

/** Credential info returned by the API (never contains raw tokens) */
export interface OandaCredentials {
  accountId: string
  hasToken: boolean
  tokenLastFour: string
}

/** Full settings response from GET /api/settings */
export interface SettingsResponse {
  tradingMode: TradingMode
  oanda: {
    practice: OandaCredentials
    live: OandaCredentials
  }
}

/** Request body for saving/updating credentials */
export interface SaveCredentialsRequest {
  mode: TradingMode
  token?: string
  accountId: string
}

/** Request body for updating trading mode */
export interface UpdateTradingModeRequest {
  mode: TradingMode
}

/** Response from test-connection endpoint */
export interface TestConnectionResponse {
  success: boolean
  accountName?: string
  error?: string
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T = void> {
  ok: boolean
  data?: T
  error?: string
}

// ─── Connection Status ──────────────────────────────────────────────────────

/** Extended status state including 'unconfigured' for when no credentials exist */
export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "warning" | "unconfigured"

// ─── Market Status ──────────────────────────────────────────────────────────

/** Why the market is currently closed */
export type MarketCloseReason =
  | "weekend" // Fri 5PM ET → Sun 5PM ET
  | "rollover" // Daily 4:59 PM → 5:05 PM ET maintenance window
  | "holiday" // Inferred: non-tradeable outside normal maintenance hours
  | "paused" // Catch-all: OANDA reports non-tradeable for unknown reason

export interface MarketStatusData {
  /** Whether the Forex market is currently tradeable */
  isOpen: boolean
  /** Reason for closure when isOpen is false; null when open */
  closeReason: MarketCloseReason | null
  /** ISO timestamp of the last tradeable status change from OANDA */
  lastStatusChange: string
  /** ISO timestamp of the next expected state change (countdown target) */
  nextExpectedChange: string | null
  /** Human-readable label: "Weekend Close", "Daily Rollover", etc. */
  closeLabel: string | null
}

// ─── OANDA Health ───────────────────────────────────────────────────────────

export interface OandaHealthData {
  /** Overall OANDA connection status */
  status: ConnectionStatus
  /** Whether the pricing stream is actively receiving data */
  streamConnected: boolean
  /** Whether the REST API is reachable */
  apiReachable: boolean
  /** Whether the account credentials are valid */
  accountValid: boolean
  /** Margin call detection (marginCallPercent >= 1.0) */
  marginCallActive: boolean
  /** Current margin call percentage (0.0 = safe, >= 1.0 = margin call) */
  marginCallPercent: number
  /** Account balance */
  balance: number
  /** Available margin */
  marginAvailable: number
  /** Number of open trades */
  openTradeCount: number
  /** Number of open positions */
  openPositionCount: number
  /** Number of pending orders */
  pendingOrderCount: number
  /** ISO timestamp of the last successful health check */
  lastHealthCheck: string | null
  /** Human-readable error message if status is not 'connected' */
  errorMessage: string | null
  /** Which trading mode is being monitored */
  tradingMode: TradingMode
}

// ─── Daemon Status (aggregate) ──────────────────────────────────────────────

export interface DaemonStatusSnapshot {
  /** Daemon uptime in seconds */
  uptimeSeconds: number
  /** ISO timestamp when daemon started */
  startedAt: string
  /** Current trading mode the daemon is monitoring */
  tradingMode: TradingMode
  /** OANDA health data */
  oanda: OandaHealthData
  /** Market status data */
  market: MarketStatusData
  /** Account overview data (null until first data load) */
  accountOverview: AccountOverviewData | null
  /** Positions data (null until first sync) */
  positions: PositionsData | null
  /** Positions summary for header pills (null until first sync) */
  positionsSummary: PositionsSummary | null
  /** TV Alerts module status (null if not configured) */
  tvAlerts: TVAlertsStatusData | null
}

// ─── Account Overview ──────────────────────────────────────────────────────

/** Full account summary data from OANDA /v3/accounts/{id}/summary */
export interface AccountSummaryData {
  /** Account ID (e.g., "001-004-1234567-001") */
  accountId: string
  /** Account alias/name */
  alias: string
  /** Account home currency (e.g., "USD", "EUR", "GBP") */
  currency: string
  /** Account balance */
  balance: number
  /** Net Asset Value (balance + unrealizedPL) */
  nav: number
  /** Unrealized P&L across all open trades */
  unrealizedPL: number
  /** Lifetime realized P&L */
  pl: number
  /** Lifetime financing charges */
  financing: number
  /** Lifetime commission charges */
  commission: number
  /** Margin currently in use */
  marginUsed: number
  /** Margin available for new trades */
  marginAvailable: number
  /** Margin closeout percentage (>= 1.0 = closeout) */
  marginCloseoutPercent: number
  /** Number of open trades */
  openTradeCount: number
  /** Number of open positions */
  openPositionCount: number
  /** Number of pending orders */
  pendingOrderCount: number
  /** Total position value in home currency */
  positionValue: number
  /** Current withdrawal limit */
  withdrawalLimit: number
  /** Whether hedging is enabled */
  hedgingEnabled: boolean
  /** ISO timestamp of last order fill */
  lastOrderFillTimestamp: string | null
  /** ISO timestamp when account was created */
  createdTime: string
}

/** P&L breakdown for a single time period */
export interface PeriodPnL {
  /** Realized P&L from closed trades */
  realizedPL: number
  /** Financing charges (swaps/interest) */
  financing: number
  /** Commission charges */
  commission: number
  /** Net P&L = realizedPL + financing + commission */
  net: number
  /** Number of trades closed in this period */
  tradeCount: number
}

/** Time period identifiers for P&L calculations */
export type PnLPeriod = "today" | "yesterday" | "thisWeek" | "thisMonth" | "thisYear" | "allTime"

/** Full account overview data sent from daemon to clients */
export interface AccountOverviewData {
  /** Full account summary from OANDA */
  summary: AccountSummaryData
  /** P&L breakdown by period */
  pnl: Record<PnLPeriod, PeriodPnL>
  /** ISO timestamp when this data was last updated */
  lastUpdated: string
}

// ─── Trade / Position Types ─────────────────────────────────────────────────

export type TradeDirection = "long" | "short"
export type TradeStatus = "pending" | "open" | "closed"
export type TradeSource = "oanda" | "manual" | "automated" | "ut_bot_alerts" | "trade_finder" | "trade_finder_auto"

export type OrderType =
  | "LIMIT"
  | "STOP"
  | "MARKET_IF_TOUCHED"
  | "MARKET"
  | "TAKE_PROFIT"
  | "STOP_LOSS"
  | "TRAILING_STOP_LOSS"

export type TradeCloseReason =
  | "MARKET_ORDER"
  | "STOP_LOSS_ORDER"
  | "TAKE_PROFIT_ORDER"
  | "TRAILING_STOP_LOSS_ORDER"
  | "MARGIN_CLOSEOUT"
  | "LINKED_TRADE_CLOSED"
  | "REVERSAL"
  | "UNKNOWN"

export type TradeOutcome = "win" | "loss" | "breakeven"

export type Timeframe =
  | "M1" | "M5" | "M15" | "M30"
  | "H1" | "H4"
  | "D" | "W" | "M"

// ─── Pending Order Data ────────────────────────────────────────────────────

export interface PendingOrderData {
  id: string
  source: TradeSource
  sourceOrderId: string
  instrument: string
  direction: TradeDirection
  orderType: OrderType
  units: number
  entryPrice: number
  stopLoss: number | null
  takeProfit: number | null
  trailingStopDistance: number | null
  timeInForce: "GTC" | "GTD" | "GFD" | "FOK" | "IOC"
  gtdTime: string | null
  timeframe: Timeframe | null
  notes: string | null
  tags: TradeTagData[]
  createdAt: string
}

// ─── Open Trade Data ───────────────────────────────────────────────────────

export interface OpenTradeData {
  id: string
  source: TradeSource
  sourceTradeId: string
  instrument: string
  direction: TradeDirection
  entryPrice: number
  currentPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  trailingStopDistance: number | null
  initialUnits: number
  currentUnits: number
  unrealizedPL: number
  realizedPL: number
  financing: number
  marginUsed: number
  /** Max Favorable Excursion in pips (highest unrealized profit during trade) */
  mfe: number | null
  /** Max Adverse Excursion in pips (deepest unrealized loss during trade) */
  mae: number | null
  timeframe: Timeframe | null
  notes: string | null
  tags: TradeTagData[]
  openedAt: string
}

// ─── Closed Trade Data ─────────────────────────────────────────────────────

export interface ClosedTradeData {
  id: string
  source: TradeSource
  sourceTradeId: string
  instrument: string
  direction: TradeDirection
  entryPrice: number
  exitPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  units: number
  realizedPL: number
  financing: number
  closeReason: TradeCloseReason
  outcome: TradeOutcome
  /** Max Favorable Excursion in pips (null for backfilled trades) */
  mfe: number | null
  /** Max Adverse Excursion in pips (null for backfilled trades) */
  mae: number | null
  timeframe: Timeframe | null
  notes: string | null
  tags: TradeTagData[]
  openedAt: string
  closedAt: string
}

// ─── Aggregate Positions Payload ───────────────────────────────────────────

export interface PositionsData {
  pending: PendingOrderData[]
  open: OpenTradeData[]
  /** Today's closed trades only (forex day boundary) */
  closed: ClosedTradeData[]
  lastUpdated: string
}

// ─── Live Price Tick ───────────────────────────────────────────────────────

export interface PositionPriceTick {
  instrument: string
  bid: number
  ask: number
  time: string
}

export interface PositionsPriceData {
  prices: PositionPriceTick[]
}

// ─── Positions Summary (for header pills) ──────────────────────────────────

export interface PositionsSummary {
  pendingCount: number
  openCount: number
  closedTodayCount: number
  todayWins: number
  todayLosses: number
  todayNetPL: number
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export interface TagData {
  id: string
  name: string
  color: string
}

export interface TradeTagData {
  tagId: string
  tag: TagData
  assignedAt: string
}

// ─── Trade Actions ──────────────────────────────────────────────────────────

export interface CancelOrderRequest {
  sourceOrderId: string
}

export interface CloseTradeRequest {
  sourceTradeId: string
  /** Omit or set to undefined for full close; specify units for partial close */
  units?: number
}

export interface ModifyTradeRequest {
  sourceTradeId: string
  /** null = remove SL; undefined = leave unchanged */
  stopLoss?: number | null
  /** null = remove TP; undefined = leave unchanged */
  takeProfit?: number | null
}

export interface TradeActionResponse<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

// ─── Order Placement ──────────────────────────────────────────────────────────

/** Order types supported for placement */
export type PlaceableOrderType = "MARKET" | "LIMIT"

/** Request body for placing a new order */
export interface PlaceOrderRequest {
  instrument: string
  direction: TradeDirection
  orderType: PlaceableOrderType
  /** Absolute number of units (always positive; daemon applies sign from direction) */
  units: number
  /** Required for LIMIT orders — the entry price */
  entryPrice?: number
  /** Stop loss price (null = no SL) */
  stopLoss: number | null
  /** Take profit price (null = no TP) */
  takeProfit: number | null
  /** Optional timeframe to tag the order with (e.g., "H1", "M15") */
  timeframe?: Timeframe | null
  /** Notes to attach to the trade at placement time */
  notes?: string | null
  /** Tag IDs to assign to the trade after placement */
  tagIds?: string[]
  /** Identifies the origin of this order for source tracking metadata */
  placedVia?: "fxflow" | "ut_bot_alerts" | "trade_finder" | "trade_finder_auto"
}

/** Response data after successful order placement */
export interface PlaceOrderResponseData {
  /** OANDA order ID (for limit) or trade ID (for filled market) */
  sourceId: string
  /** Whether the order was filled immediately (market orders) */
  filled: boolean
  /** Fill price if filled immediately */
  fillPrice?: number
}

// ─── Trade Events (for timeline display) ─────────────────────────────────────

export interface TradeEventData {
  id: string
  eventType: string
  detail: string // JSON
  createdAt: string
}

// ─── Trade Detail (for drawer) ───────────────────────────────────────────────

export interface TradeDetailData {
  id: string
  source: string
  sourceTradeId: string
  status: string
  instrument: string
  direction: string
  orderType: string | null
  entryPrice: number
  exitPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  trailingStopDistance: number | null
  initialUnits: number
  currentUnits: number
  realizedPL: number
  unrealizedPL: number
  financing: number
  closeReason: string | null
  timeInForce: string | null
  gtdTime: string | null
  mfe: number | null
  mae: number | null
  notes: string | null
  timeframe: Timeframe | null
  openedAt: string
  closedAt: string | null
  tags: TradeTagData[]
  events: TradeEventData[]
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationSeverity = "critical" | "warning" | "info"

export type NotificationSource =
  | "internet"
  | "oanda_api"
  | "oanda_stream"
  | "daemon"
  | "user_action"
  | "tv_alerts"
  | "ai_analysis"
  | "trade_condition"
  | "trade_finder"

export interface NotificationData {
  id: string
  severity: NotificationSeverity
  source: NotificationSource
  title: string
  message: string
  /** Optional JSON metadata for deep links (e.g. { analysisId, tradeId }) */
  metadata: string | null
  dismissed: boolean
  createdAt: string
}

export interface NotificationListResponse {
  notifications: NotificationData[]
  totalCount: number
  undismissedCount: number
}

// ─── Chart Layout ────────────────────────────────────────────────────────────

/** Preset grid layout types for the multi-chart page */
export type ChartGridLayout =
  | "single"
  | "2-horizontal"
  | "2-vertical"
  | "3-left"
  | "4-grid"
  | "6-grid"

/** Configuration for a single chart panel */
export interface ChartPanelConfig {
  instrument: string
  timeframe: string
  /** Per-chart zone display overrides */
  zoneOverrides?: ChartPanelZoneOverrides
  /** Per-chart trend display overrides */
  trendOverrides?: ChartPanelTrendOverrides
}

/** Full chart layout state (persisted to DB) */
export interface ChartLayoutData {
  layout: ChartGridLayout
  panels: ChartPanelConfig[]
}

// ─── WebSocket Messages (Daemon → Client) ───────────────────────────────────

export type DaemonMessageType =
  | "status_snapshot"
  | "oanda_update"
  | "market_update"
  | "error"
  | "notification_created"
  | "account_overview_update"
  | "positions_update"
  | "positions_price_update"
  | "chart_price_update"
  | "tv_alert_signal"
  | "tv_alerts_status"
  | "ai_analysis_started"
  | "ai_analysis_update"
  | "ai_analysis_completed"
  | "ai_auto_analysis_disabled"
  | "condition_triggered"
  | "trade_finder_setup_found"
  | "trade_finder_setup_updated"
  | "trade_finder_setup_removed"
  | "trade_finder_scan_status"
  | "trade_finder_auto_trade_placed"
  | "trade_finder_auto_trade_filled"
  | "trade_finder_auto_trade_cancelled"
  | "trade_finder_auto_trade_skipped"

export interface DaemonMessage<T = unknown> {
  type: DaemonMessageType
  timestamp: string
  data: T
}

export interface StatusSnapshotMessage extends DaemonMessage<DaemonStatusSnapshot> {
  type: "status_snapshot"
}

export interface OandaUpdateMessage extends DaemonMessage<OandaHealthData> {
  type: "oanda_update"
}

export interface MarketUpdateMessage extends DaemonMessage<MarketStatusData> {
  type: "market_update"
}

export interface DaemonErrorMessage extends DaemonMessage<{ message: string; code?: string }> {
  type: "error"
}

export interface NotificationCreatedMessage extends DaemonMessage<NotificationData> {
  type: "notification_created"
}

export interface AccountOverviewUpdateMessage extends DaemonMessage<AccountOverviewData> {
  type: "account_overview_update"
}

export interface PositionsUpdateMessage extends DaemonMessage<PositionsData> {
  type: "positions_update"
}

export interface PositionsPriceUpdateMessage extends DaemonMessage<PositionsPriceData> {
  type: "positions_price_update"
}

export interface ChartPriceUpdateMessage extends DaemonMessage<PositionsPriceData> {
  type: "chart_price_update"
}

export interface TVAlertSignalMessage extends DaemonMessage<TVAlertSignal> {
  type: "tv_alert_signal"
}

export interface TVAlertsStatusMessage extends DaemonMessage<TVAlertsStatusData> {
  type: "tv_alerts_status"
}

export interface AiAnalysisStartedMessage extends DaemonMessage<{ analysisId: string; tradeId: string; model: string; depth: string }> {
  type: "ai_analysis_started"
}

export interface AiAnalysisUpdateMessage extends DaemonMessage<{ analysisId: string; tradeId: string; stage?: string; progress?: number; chunk?: string }> {
  type: "ai_analysis_update"
}

export interface AiAnalysisCompletedMessage extends DaemonMessage<{ analysisId: string; tradeId: string; sections: AiAnalysisSections | null; inputTokens: number; outputTokens: number; costUsd: number; durationMs: number; error?: string }> {
  type: "ai_analysis_completed"
}

export interface AiAutoAnalysisDisabledMessage extends DaemonMessage<{ reason: string; disabledAt: string; lastFailureMessage: string }> {
  type: "ai_auto_analysis_disabled"
}

export interface ConditionTriggeredMessage extends DaemonMessage<{ conditionId: string; tradeId: string; instrument: string; label: string | null; actionType: string; success: boolean; error?: string }> {
  type: "condition_triggered"
}

export interface TradeFinderSetupFoundMessage extends DaemonMessage<TradeFinderSetupData> {
  type: "trade_finder_setup_found"
}

export interface TradeFinderSetupUpdatedMessage extends DaemonMessage<TradeFinderSetupData> {
  type: "trade_finder_setup_updated"
}

export interface TradeFinderSetupRemovedMessage extends DaemonMessage<{ setupId: string; instrument: string; reason: string }> {
  type: "trade_finder_setup_removed"
}

export interface TradeFinderScanStatusMessage extends DaemonMessage<TradeFinderScanStatus> {
  type: "trade_finder_scan_status"
}

export interface TradeFinderAutoTradePlacedMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  direction: TradeDirection
  orderType: "LIMIT"
  entryPrice: number
  stopLoss: number
  takeProfit: number
  positionSize: number
  score: number
  sourceId: string
}> {
  type: "trade_finder_auto_trade_placed"
}

export interface TradeFinderAutoTradeCancelledMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  reason: string
  sourceOrderId: string
}> {
  type: "trade_finder_auto_trade_cancelled"
}

export interface TradeFinderAutoTradeFilledMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  direction: TradeDirection
  sourceId: string
  score: number
}> {
  type: "trade_finder_auto_trade_filled"
}

export interface TradeFinderAutoTradeSkippedMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  score: number
  reason: string
}> {
  type: "trade_finder_auto_trade_skipped"
}

/** Auto-trade activity event for the activity log */
export interface TradeFinderAutoTradeEvent {
  type: "placed" | "filled" | "skipped" | "cancelled" | "failed"
  setupId: string
  instrument: string
  direction: TradeDirection
  score: number
  reason?: string
  sourceId?: string
  entryPrice?: number
  timestamp: string
}

export type AnyDaemonMessage =
  | StatusSnapshotMessage
  | OandaUpdateMessage
  | MarketUpdateMessage
  | DaemonErrorMessage
  | NotificationCreatedMessage
  | AccountOverviewUpdateMessage
  | PositionsUpdateMessage
  | PositionsPriceUpdateMessage
  | ChartPriceUpdateMessage
  | TVAlertSignalMessage
  | TVAlertsStatusMessage
  | AiAnalysisStartedMessage
  | AiAnalysisUpdateMessage
  | AiAnalysisCompletedMessage
  | AiAutoAnalysisDisabledMessage
  | ConditionTriggeredMessage
  | TradeFinderSetupFoundMessage
  | TradeFinderSetupUpdatedMessage
  | TradeFinderSetupRemovedMessage
  | TradeFinderScanStatusMessage
  | TradeFinderAutoTradePlacedMessage
  | TradeFinderAutoTradeFilledMessage
  | TradeFinderAutoTradeCancelledMessage
  | TradeFinderAutoTradeSkippedMessage

// ─── TradingView Alerts ────────────────────────────────────────────────────

/** Signal direction from TradingView indicator */
export type TVSignalDirection = "buy" | "sell"

/** Alert processing status */
export type TVAlertStatus =
  | "received"
  | "executing"
  | "executed"
  | "skipped"
  | "rejected"
  | "failed"

/** Rejection / skip reason codes */
export type TVAlertRejectionReason =
  | "invalid_token"
  | "invalid_payload"
  | "unknown_instrument"
  | "duplicate_signal"
  | "cooldown_active"
  | "kill_switch_active"
  | "max_positions_reached"
  | "daily_loss_limit"
  | "market_closed"
  | "pair_not_whitelisted"
  | "manual_position_conflict"
  | "same_direction_exists"
  | "execution_failed"

/** Raw webhook payload from TradingView */
export interface TVWebhookPayload {
  action: TVSignalDirection
  ticker: string
  /** Signal price at time of alert */
  price?: number
  /** Exchange prefix (e.g., "FX", "OANDA") */
  exchange?: string
  /** Chart timeframe (e.g., "15", "60", "D") */
  interval?: string
  /** ISO timestamp from TradingView */
  time?: string
  /** Auth token embedded in payload (optional secondary auth) */
  token?: string
}

/** Processed and validated signal */
export interface TVAlertSignal {
  id: string
  /** Which indicator module produced this signal */
  source: "ut_bot_alerts" | string
  /** OANDA instrument format (e.g., "EUR_USD") */
  instrument: string
  direction: TVSignalDirection
  status: TVAlertStatus
  rejectionReason: TVAlertRejectionReason | null
  /** The raw payload from TradingView */
  rawPayload: TVWebhookPayload
  /** Resulting trade source ID (if executed) */
  resultTradeId: string | null
  /** Execution details (if executed or partially executed) */
  executionDetails: TVExecutionDetails | null
  /** Whether this signal was sent from the test pipeline */
  isTest: boolean
  /** TradingView candle close time (from rawPayload.time). Null if not provided in webhook. */
  signalTime: string | null
  receivedAt: string
  processedAt: string | null
}

/** Execution details for a signal that was traded */
export interface TVExecutionDetails {
  /** Whether this was a reversal (close + open) */
  isReversal: boolean
  /** Whether this was a protective close — existing position closed but no new position opened (circuit breaker active) */
  isProtectiveClose?: boolean
  /** Source trade ID that was closed (if reversal or protective close). First ID for backward compat. */
  closedTradeId: string | null
  /** All trade IDs closed by this signal (reversals may close multiple positions on the pair). */
  closedTradeIds?: string[]
  /** Source trade ID that was opened */
  openedTradeId: string | null
  /** Units traded */
  units: number
  /** Fill price */
  fillPrice: number | null
  /** Retry attempt number (0 = first try) */
  retryAttempt: number
  /** Realized P&L (backfilled after trade closes) */
  realizedPL?: number
  /** Financing/swap charges (backfilled after trade closes) */
  financing?: number
}

/** TV Alerts module configuration (persisted in DB) */
export interface TVAlertsConfig {
  /** Master enable/disable */
  enabled: boolean
  /** Webhook secret token (for URL path authentication) */
  webhookToken: string
  /** Position sizing: percentage of account balance */
  positionSizePercent: number
  /** Cooldown period in seconds (prevents whipsaw) */
  cooldownSeconds: number
  /** Maximum concurrent auto-trade positions */
  maxOpenPositions: number
  /** Daily loss limit in account currency (0 = disabled) */
  dailyLossLimit: number
  /** Allowed pairs — empty array means all pairs allowed */
  pairWhitelist: string[]
  /** Whether to filter signals during market closed hours */
  marketHoursFilter: boolean
  /** Signal dedup window in seconds */
  dedupWindowSeconds: number
  /** Whether to show chart signal markers by default */
  showChartMarkers: boolean
  /** Whether to play sound on new signal */
  soundEnabled: boolean
  /** CF Worker WebSocket URL (e.g. wss://fxflow-tv-alerts.workers.dev/ws/secret) */
  cfWorkerUrl: string
  /** Daemon authentication secret for CF Worker */
  cfWorkerSecret: string
}

/** Default configuration values */
export const TV_ALERTS_DEFAULT_CONFIG: TVAlertsConfig = {
  enabled: false,
  webhookToken: "",
  positionSizePercent: 1,
  cooldownSeconds: 60,
  maxOpenPositions: 3,
  dailyLossLimit: 0,
  pairWhitelist: [],
  marketHoursFilter: true,
  dedupWindowSeconds: 5,
  showChartMarkers: true,
  soundEnabled: true,
  cfWorkerUrl: "",
  cfWorkerSecret: "",
}

/** TV Alerts system status (daemon → client, real-time) */
export interface TVAlertsStatusData {
  /** Whether the module is enabled (kill switch state) */
  enabled: boolean
  /** Whether the daemon is connected to the CF Worker DO */
  cfWorkerConnected: boolean
  /** Number of active auto-trade positions (source = ut_bot_alerts) */
  activeAutoPositions: number
  /** Today's auto-trade realized P&L */
  todayAutoPL: number
  /** Whether daily loss limit is breached (circuit breaker) */
  circuitBreakerTripped: boolean
  /** Number of signals received today */
  signalCountToday: number
  /** Last signal received ISO timestamp */
  lastSignalAt: string | null
  /** Per-pair cooldown remaining in seconds */
  cooldowns: Record<string, number>
}

/** Performance stats for signal tracking */
export interface TVSignalPerformanceStats {
  totalSignals: number
  executedSignals: number
  rejectedSignals: number
  failedSignals: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  totalPL: number
  averageWin: number
  averageLoss: number
  profitFactor: number
}

/** P&L for a single period derived from TV alert signals */
export interface TVSignalPeriodPnL {
  /** Net P&L (sum of realized P&L from executed signals in this period) */
  net: number
  /** Number of executed signals in this period */
  signalCount: number
  /** Wins / losses / breakeven */
  wins: number
  losses: number
}

/** Period-based P&L breakdown for TV alerts */
export type TVSignalPeriodPnLData = Record<PnLPeriod, TVSignalPeriodPnL>

// ─── CF Worker ↔ Daemon Messages ───────────────────────────────────────────

/** CF Worker → Daemon message types */
export type CFWorkerMessageType = "signal" | "heartbeat" | "queued_signals"

export interface CFWorkerMessage<T = unknown> {
  type: CFWorkerMessageType
  timestamp: string
  data: T
}

/** Daemon → CF Worker message types */
export type DaemonToCFMessageType = "authenticate" | "signal_ack" | "status"

export interface DaemonToCFMessage<T = unknown> {
  type: DaemonToCFMessageType
  timestamp: string
  data: T
}

/** Signal list response (paginated) */
export interface TVSignalListResponse {
  signals: TVAlertSignal[]
  totalCount: number
  page: number
  pageSize: number
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

/** Threshold for labeling an analysis as stuck in UI indicators */
export const ANALYSIS_STUCK_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

/** Threshold for ignoring old running analyses on page load (too old to restore spinner) */
export const ANALYSIS_STALE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

export type AiAnalysisStatus = "pending" | "running" | "completed" | "failed" | "cancelled"
export type AiAnalysisDepth = "quick" | "standard" | "deep"
export type AiAnalysisTriggeredBy = "user" | "auto_pending" | "auto_fill" | "auto_close" | "auto_interval"

export type AiClaudeModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-6"
  | "claude-opus-4-6"

export interface AiModelOption {
  id: AiClaudeModel
  name: string
  description: string
  inputCostPer1M: number
  outputCostPer1M: number
  estimatedDurationSec: number
}

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: "claude-haiku-4-5-20251001",
    name: "Haiku — Quick",
    description: "Fast assessment, key risks, basic recommendations",
    inputCostPer1M: 0.8,
    outputCostPer1M: 4,
    estimatedDurationSec: 8,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Sonnet — Standard",
    description: "Balanced depth, technical analysis, full recommendations",
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    estimatedDurationSec: 25,
  },
  {
    id: "claude-opus-4-6",
    name: "Opus — Deep",
    description: "Comprehensive multi-timeframe analysis, highest quality insights",
    inputCostPer1M: 15,
    outputCostPer1M: 75,
    estimatedDurationSec: 60,
  },
]

export type AiActionButtonType =
  | "adjust_sl"
  | "adjust_tp"
  | "adjust_tp_partial"
  | "adjust_entry" // pending orders only: modifies entry price
  | "partial_close"
  | "close_trade"
  | "cancel_order"
  | "add_condition" // converted to conditionSuggestions in the Conditions tab
  | "update_expiry" // pending orders only: sets GTD expiry
  | "move_to_breakeven"

export interface AiActionButton {
  id: string
  type: AiActionButtonType
  label: string
  description: string
  /** Pre-computed params for pre-filling existing dialogs */
  params: Record<string, unknown>
  confidence: "high" | "medium" | "low"
  rationale: string
}

export interface AiConditionSuggestion {
  label: string
  triggerType: string
  triggerValue: Record<string, unknown>
  actionType: string
  actionParams: Record<string, unknown>
  rationale: string
  /** Confidence level for the suggestion (optional for backward compat with existing stored analyses) */
  confidence?: "high" | "medium" | "low"
}

export interface AiKeyLevel {
  price: number
  label: string
  type: "support" | "resistance" | "pivot"
}

export interface AiNewsEvent {
  title: string
  time: string
  currency: string
  impact: "low" | "medium" | "high"
  forecast?: string
  previous?: string
}

export interface AiAnalysisSections {
  summary: string
  winProbability: number
  tradeQualityScore: number
  /** TL;DR action card — the single most important recommendation */
  tldr?: {
    action: "hold" | "close" | "adjust" | "reduce" | "watch" | "exit_now"
    sentence: string
    urgency: "now" | "soon" | "monitor"
  }
  /** Multi-timeframe confluence scoring */
  confluenceScore?: {
    m15Trend: "bullish" | "bearish" | "sideways"
    h1Trend: "bullish" | "bearish" | "sideways"
    h4Trend: "bullish" | "bearish" | "sideways"
    alignment: "strong" | "moderate" | "weak" | "conflicting"
    score: number
    explanation: string
  }
  /** Entry quality assessment */
  entryQuality?: {
    score: number
    levelType: string
    distanceFromKey: string
    timingNote: string
    improvements: string
  }
  technical: {
    trend: string
    keyLevels: AiKeyLevel[]
    indicators: string
    candlePatterns: string
    momentum: string
    /** Educational explanation (only when learning mode enabled) */
    educational?: string
  }
  risk: {
    assessment: "low" | "medium" | "high" | "very_high"
    factors: string[]
    riskRewardAnalysis: string
    positionSizingComment: string
    educational?: string
  }
  /** Portfolio-level risk assessment */
  portfolioRisk?: {
    correlatedExposure: string | null
    totalRiskPercent: string
    concentrationWarning: string | null
  }
  marketContext: {
    currentSession: string
    volatility: string
    newsEvents: AiNewsEvent[]
    correlations: string
    sentimentNote: string
    educational?: string
  }
  tradeHistory: {
    pairWinRate: string
    averageRR: string
    commonPatterns: string
    recentPerformance: string
    educational?: string
  }
  recommendations: string[]
  immediateActions: AiActionButton[]
  conditionSuggestions: AiConditionSuggestion[]
  postMortem?: string
  /** Action IDs that were auto-executed by the daemon (set post-analysis, not by AI) */
  autoAppliedActionIds?: string[]
}

export interface AiAnalysisData {
  id: string
  tradeId: string
  status: AiAnalysisStatus
  depth: AiAnalysisDepth
  model: AiClaudeModel
  tradeStatus: string
  triggeredBy: AiAnalysisTriggeredBy
  sections: AiAnalysisSections | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface AiUsageStats {
  totalAnalyses: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  avgWinProbability: number | null
  avgQualityScore: number | null
  autoCount: number
  manualCount: number
  byModel: Array<{
    model: string
    count: number
    inputTokens: number
    outputTokens: number
    costUsd: number
  }>
  byPeriod: {
    today: { count: number; costUsd: number }
    thisWeek: { count: number; costUsd: number }
    thisMonth: { count: number; costUsd: number }
    thisYear: { count: number; costUsd: number }
    allTime: { count: number; costUsd: number }
  }
  statusCounts: {
    completed: number
    failed: number
    cancelled: number
    running: number
    pending: number
  }
}

export interface AiAutoAnalysisSettings {
  enabled: boolean
  onPendingCreate: boolean
  onOrderFill: boolean
  onTradeClose: boolean
  intervalEnabled: boolean
  intervalHours: number
  defaultDepth: AiAnalysisDepth
  defaultModel: AiClaudeModel
  liveAutoApplyEnabled: boolean
  practiceAutoApplyEnabled: boolean
  /** Minimum confidence level for auto-applying actions */
  autoApplyMinConfidence: "high" | "medium" | "low"
  /** Automatically create conditions suggested by AI after analysis completes */
  autoApplyConditions: boolean
  /** Minimum confidence level for auto-applying condition suggestions */
  autoApplyMinConditionConfidence: "high" | "medium" | "low"
  notifyOnComplete: boolean
  /** Learning mode: AI includes educational explanations in each section */
  learningMode: boolean
  /** Periodic digest generation */
  digestEnabled: boolean
  digestFrequency: "weekly" | "monthly" | "both"
  /** Set when auto-analysis is disabled due to repeated failures */
  autoDisabledReason?: string | null
  /** ISO timestamp of when auto-analysis was auto-disabled */
  autoDisabledAt?: string | null
}

export const AI_AUTO_ANALYSIS_DEFAULTS: AiAutoAnalysisSettings = {
  enabled: false,
  onPendingCreate: false,
  onOrderFill: true,
  onTradeClose: true,
  intervalEnabled: false,
  intervalHours: 4,
  defaultDepth: "standard",
  defaultModel: "claude-sonnet-4-6",
  liveAutoApplyEnabled: false,
  practiceAutoApplyEnabled: false,
  autoApplyMinConfidence: "high",
  autoApplyConditions: false,
  autoApplyMinConditionConfidence: "medium",
  notifyOnComplete: true,
  learningMode: false,
  digestEnabled: false,
  digestFrequency: "weekly",
}

export interface AiSettingsData {
  hasClaudeKey: boolean
  claudeKeyLastFour: string
  hasFinnhubKey: boolean
  finnhubKeyLastFour: string
  defaultModel: AiClaudeModel
  autoAnalysis: AiAutoAnalysisSettings
}

// ─── AI Accuracy & Digest ────────────────────────────────────────────────────

export interface AiAccuracyStats {
  totalRecommendations: number
  followedCount: number
  ignoredCount: number
  followedWinRate: number | null
  ignoredWinRate: number | null
  overallPredictedWinRate: number | null
  overallActualWinRate: number | null
  calibration: Array<{
    bucket: string
    predictedAvg: number
    actualWinRate: number | null
    count: number
  }>
}

export interface AiDigestSections {
  periodSummary: string
  totalTrades: number
  winRate: number
  totalPnl: number
  bestPair: { instrument: string; pnl: number; trades: number } | null
  worstPair: { instrument: string; pnl: number; trades: number } | null
  bestSession: string | null
  worstSession: string | null
  patterns: string[]
  mistakes: string[]
  improvements: string[]
  riskManagement: string
  emotionalPatterns: string | null
  goalSuggestion: string
}

export interface AiDigestData {
  id: string
  period: "weekly" | "monthly"
  periodStart: string
  periodEnd: string
  status: string
  sections: AiDigestSections | null
  costUsd: number
  durationMs: number
  createdAt: string
}

// ─── Trade Conditions ─────────────────────────────────────────────────────────

export type TradeConditionTriggerType =
  | "price_reaches"
  | "price_breaks_above"
  | "price_breaks_below"
  | "pnl_pips"
  | "pnl_currency"
  | "time_reached"
  | "duration_hours"
  | "trailing_stop"

export type TradeConditionActionType =
  | "close_trade"
  | "partial_close"
  | "move_stop_loss"
  | "move_take_profit"
  | "cancel_order"
  | "notify"

export type TradeConditionStatus = "active" | "waiting" | "executing" | "triggered" | "expired" | "cancelled"

export interface TradeConditionData {
  id: string
  tradeId: string
  triggerType: TradeConditionTriggerType
  triggerValue: Record<string, unknown>
  actionType: TradeConditionActionType
  actionParams: Record<string, unknown>
  status: TradeConditionStatus
  label: string | null
  createdBy: "user" | "ai"
  analysisId: string | null
  priority: number
  parentConditionId: string | null
  expiresAt: string | null
  triggeredAt: string | null
  createdAt: string
  updatedAt: string
}

// ─── Supply & Demand Zones ──────────────────────────────────────────────────

/** Zone type: demand (buy setup) or supply (sell setup) */
export type ZoneType = "demand" | "supply"

/** Formation type determines distal line placement */
export type ZoneFormationType = "DBR" | "RBR" | "RBD" | "DBD"

/** Zone lifecycle status */
export type ZoneStatus = "active" | "tested" | "invalidated"

/** Candle classification for the algorithm */
export type CandleClassification = "leg" | "base" | "neutral"

/** Algorithm tuning preset */
export type ZonePreset = "conservative" | "standard" | "aggressive" | "custom"

/** Raw OHLC candle input for the zone detection algorithm */
export interface ZoneCandle {
  time: number // Unix seconds
  open: number
  high: number
  low: number
  close: number
}

/** Classified candle with algorithm metadata */
export interface ClassifiedCandle extends ZoneCandle {
  classification: CandleClassification
  bodySize: number
  range: number
  bodyRatio: number
  isBullish: boolean
  bodyVsAtr: number
}

/** Individual score for one Odds Enhancer */
export interface OddsEnhancerScore {
  value: number
  max: number
  label: string
  explanation: string
}

/** Complete zone score breakdown */
export interface ZoneScores {
  strength: OddsEnhancerScore
  time: OddsEnhancerScore
  freshness: OddsEnhancerScore
  /** Trend alignment score (0-2) — only present when trend data available */
  trend?: OddsEnhancerScore
  /** Curve position score (0-1) — only present when curve data available */
  curve?: OddsEnhancerScore
  /** Profit zone score (0-3) — only present when opposing zone data available */
  profitZone?: OddsEnhancerScore
  /** Commodity correlation score (0-1) — only present for correlated pairs */
  commodityCorrelation?: OddsEnhancerScore
  total: number
}

/** Implied risk/reward from a zone to the nearest opposing zone */
export interface ZoneRiskReward {
  entryPrice: number
  stopLossPrice: number
  takeProfitPrice: number | null
  riskPips: number
  rewardPips: number | null
  ratio: string | null
}

/** A detected supply or demand zone */
export interface ZoneData {
  id: string
  type: ZoneType
  formation: ZoneFormationType
  instrument: string
  timeframe: string
  proximalLine: number
  distalLine: number
  width: number
  widthPips: number
  baseStartTime: number
  baseEndTime: number
  baseCandles: number
  baseStartIndex: number
  baseEndIndex: number
  scores: ZoneScores
  riskReward: ZoneRiskReward
  status: ZoneStatus
  penetrationPercent: number
  testCount: number
  ageInCandles: number
  distanceFromPricePips: number
}

/** Higher-timeframe curve alignment */
export type CurveAlignment = "aligned" | "conflicting" | "neutral"

/** Where price sits on the curve */
export type CurvePosition = "high" | "middle" | "low" | "above" | "below" | "none"

/** Curve display settings (nested in ZoneDisplaySettings) */
export interface CurveSettings {
  enabled: boolean
  /** Explicit timeframe for curve zones — null means use HTF zones */
  timeframe: string | null
  /** Opacity of curve band fills (0.0 - 1.0) */
  opacity: number
  /** Show curve position label on price axis */
  showAxisLabel: boolean
}

/** Computed curve state for rendering */
export interface CurveData {
  /** Distal line of best supply zone (top of curve) */
  supplyDistal: number
  /** Distal line of best demand zone (bottom of curve) */
  demandDistal: number
  /** Top third boundary (supplyDistal - 1/3 of range) */
  highThreshold: number
  /** Bottom third boundary (demandDistal + 1/3 of range) */
  lowThreshold: number
  /** Where current price sits */
  position: CurvePosition
  /** The supply zone used */
  supplyZone: ZoneData
  /** The demand zone used */
  demandZone: ZoneData
  /** Timeframe these zones came from */
  timeframe: string
  /** Opacity setting */
  opacity: number
  /** Whether to show axis labels */
  showAxisLabel: boolean
}

/** Result of zone detection for a single instrument/timeframe */
export interface ZoneDetectionResult {
  instrument: string
  timeframe: string
  zones: ZoneData[]
  nearestDemand: ZoneData | null
  nearestSupply: ZoneData | null
  currentPrice: number
  candlesAnalyzed: number
  computedAt: string
}

/** Multi-timeframe zone result */
export interface MultiTimeframeZoneResult {
  primary: ZoneDetectionResult
  higher: ZoneDetectionResult | null
  additional: ZoneDetectionResult[]
  curveAlignment: CurveAlignment
}

/** Algorithm configuration — tunable parameters */
export interface ZoneDetectionConfig {
  preset: ZonePreset
  minLegBodyRatio: number
  minLegBodyAtr: number
  maxBaseBodyRatio: number
  maxBaseCandles: number
  minMoveOutMultiple: number
  atrPeriod: number
  freshTestedThreshold: number
  freshInvalidatedThreshold: number
  minLegCandles: number
}

/** User-facing zone display settings */
export interface ZoneDisplaySettings {
  enabled: boolean
  maxZonesPerType: number
  minScore: number
  timeframeOverride: string | null
  lookbackCandles: number
  showInvalidated: boolean
  showHigherTf: boolean
  /** Explicit higher timeframe selection — null means auto (one level up) */
  higherTimeframe: string | null
  additionalTimeframes: string[]
  algorithmConfig: ZoneDetectionConfig
  /** Curve overlay settings */
  curve: CurveSettings
}

/** Per-chart zone overrides stored in ChartPanelConfig */
export interface ChartPanelZoneOverrides {
  enabled?: boolean
  maxZonesPerType?: number
  minScore?: number
  showInvalidated?: boolean
  showHigherTf?: boolean
  showCurve?: boolean
}

/** Persisted zone record with DB metadata */
export interface PersistedZoneData extends ZoneData {
  dbId: string
  firstDetectedAt: string
  lastConfirmedAt: string
  lastScoredAt: string
}

/** Zone settings API response */
export interface ZoneSettingsResponse {
  global: ZoneDisplaySettings
}

// ─── Trend Detection ────────────────────────────────────────────────────────

/** Direction of a trend */
export type TrendDirection = "up" | "down"

/** Current trend status */
export type TrendStatus = "forming" | "confirmed" | "terminated"

/** Swing point type */
export type SwingPointType = "high" | "low"

/** Swing point label for visual display */
export type SwingPointLabel = "H" | "HH" | "L" | "HL" | "LH" | "LL"

/** A detected swing point on the chart */
export interface SwingPoint {
  /** Unique identifier */
  id: string
  /** High or low */
  type: SwingPointType
  /** The price level (high of highest closing candle for swing high, low of lowest closing candle for swing low) */
  price: number
  /** Unix timestamp (seconds) of the candle at the swing point */
  time: number
  /** Label relative to the trend context */
  label: SwingPointLabel
  /** Index into the candle array where this swing was detected */
  candleIndex: number
}

/** A segment connecting two consecutive swing points */
export interface TrendSegment {
  /** Unique identifier */
  id: string
  /** Starting swing point */
  from: SwingPoint
  /** Ending swing point */
  to: SwingPoint
  /** Direction of this segment */
  direction: TrendDirection
  /** Price range of the segment in pips */
  rangePips: number
  /** Number of candles in this segment */
  candleCount: number
  /** Whether this is the breakout segment that confirmed the trend */
  isBreakout: boolean
}

/** Complete trend detection result for a single timeframe */
export interface TrendData {
  /** Instrument analyzed */
  instrument: string
  /** Timeframe analyzed */
  timeframe: string
  /** Current trend direction (null = range/no trend) */
  direction: TrendDirection | null
  /** Trend status */
  status: TrendStatus
  /** All detected swing points (ordered chronologically, oldest first) */
  swingPoints: SwingPoint[]
  /** All segments connecting swing points */
  segments: TrendSegment[]
  /** The controlling swing level — breaking this terminates the trend */
  controllingSwing: SwingPoint | null
  /** Distance from current price to controlling swing (in pips) */
  controllingSwingDistancePips: number | null
  /** Current price used for analysis */
  currentPrice: number
  /** Number of candles analyzed */
  candlesAnalyzed: number
  /** ISO timestamp when computed */
  computedAt: string
}

/** Multi-timeframe trend result */
export interface MultiTimeframeTrendResult {
  /** Primary timeframe trend */
  primary: TrendData
  /** Higher timeframe trend (if enabled) */
  higher: TrendData | null
}

// ─── Trend Display Settings ─────────────────────────────────────────────────

/** What visual elements to show on the trend overlay */
export interface TrendVisualSettings {
  /** Show colored rectangles over up/down segments */
  showBoxes: boolean
  /** Show diagonal lines connecting swing points */
  showLines: boolean
  /** Show circle markers at swing highs/lows */
  showMarkers: boolean
  /** Show labels (H, HH, HL, L, LL, LH) at swing points */
  showLabels: boolean
  /** Show the controlling swing as a horizontal price line */
  showControllingSwing: boolean
  /** Opacity for trend boxes (0.0–1.0) */
  boxOpacity: number
}

/** Trend detection algorithm configuration */
export interface TrendDetectionConfig {
  /** Number of candles on each side to confirm a swing point */
  swingStrength: number
  /** Minimum segment size as ATR multiple to qualify (filters noise) */
  minSegmentAtr: number
  /** Maximum number of swing points to detect */
  maxSwingPoints: number
  /** How many candles to look back for swing detection */
  lookbackCandles: number
}

/** Complete trend display settings (persisted) */
export interface TrendDisplaySettings {
  /** Master toggle */
  enabled: boolean
  /** Visual element toggles */
  visuals: TrendVisualSettings
  /** Algorithm configuration */
  config: TrendDetectionConfig
  /** Show higher-timeframe trend overlay */
  showHigherTf: boolean
  /** Explicit higher timeframe (null = auto one level up) */
  higherTimeframe: string | null
}

/** Per-chart trend overrides */
export interface ChartPanelTrendOverrides {
  enabled?: boolean
  showBoxes?: boolean
  showLines?: boolean
  showMarkers?: boolean
  showLabels?: boolean
  showHigherTf?: boolean
}

/** Trend settings API response */
export interface TrendSettingsResponse {
  global: TrendDisplaySettings
}

// ─── Trade Finder ───────────────────────────────────────────────────────────

/** Timeframe set defining HTF/MTF/LTF for multi-timeframe analysis */
export type TradeFinderTimeframeSet = "hourly" | "daily" | "weekly" | "monthly"

/** Mapping of TF set → HTF/MTF/LTF */
export const TIMEFRAME_SET_MAP: Record<TradeFinderTimeframeSet, { htf: string; mtf: string; ltf: string }> = {
  hourly: { htf: "H1", mtf: "M15", ltf: "M5" },
  daily: { htf: "D", mtf: "H1", ltf: "M15" },
  weekly: { htf: "W", mtf: "D", ltf: "H1" },
  monthly: { htf: "M", mtf: "W", ltf: "D" },
}

/** Scan interval per TF set (in minutes) */
export const SCAN_INTERVAL_MAP: Record<TradeFinderTimeframeSet, number> = {
  hourly: 5,
  daily: 15,
  weekly: 60,
  monthly: 60,
}

/** Setup lifecycle status */
export type TradeFinderSetupStatus =
  | "active"      // Valid setup, price not yet near entry
  | "approaching" // Price within configurable distance of entry
  | "placed"      // Order placed from this setup (pending on OANDA)
  | "filled"      // Placed order has been filled on OANDA
  | "invalidated" // Zone broken or conditions no longer met
  | "expired"     // Removed after timeout or scan cycle

/** Trade Finder configuration per instrument */
export interface TradeFinderPairConfig {
  instrument: string
  enabled: boolean
  timeframeSet: TradeFinderTimeframeSet
  /** Per-pair auto-trade override (only active when global autoTradeEnabled is true) */
  autoTradeEnabled?: boolean
}

/** Global Trade Finder settings (persisted in DB) */
export interface TradeFinderConfigData {
  enabled: boolean
  minScore: number
  riskPercent: number
  maxEnabledPairs: number
  pairs: TradeFinderPairConfig[]
  /** Approaching distance as ATR multiple */
  approachingAtrMultiple: number
  /** Master auto-trade toggle */
  autoTradeEnabled: boolean
  /** Minimum score to auto-trade (separate from display minScore) */
  autoTradeMinScore: number
  /** Max pending auto-placed orders at once */
  autoTradeMaxConcurrent: number
  /** Max auto-trades per rolling 24h window */
  autoTradeMaxDaily: number
  /** Max total risk % across all auto-placed pending orders */
  autoTradeMaxRiskPercent: number
  /** Minimum risk:reward ratio for auto-trade (e.g. 2 = 2:1) */
  autoTradeMinRR: number
  /** Auto-cancel pending auto-placed orders when zone is invalidated */
  autoTradeCancelOnInvalidation: boolean
  updatedAt: string
}

/** Score breakdown for a Trade Finder setup */
export interface TradeFinderScoreBreakdown {
  strength: OddsEnhancerScore
  time: OddsEnhancerScore
  freshness: OddsEnhancerScore
  trend: OddsEnhancerScore
  curve: OddsEnhancerScore
  profitZone: OddsEnhancerScore
  commodityCorrelation: OddsEnhancerScore
  total: number
  maxPossible: number
}

/** A detected trade setup */
export interface TradeFinderSetupData {
  id: string
  instrument: string
  direction: TradeDirection
  timeframeSet: TradeFinderTimeframeSet
  status: TradeFinderSetupStatus
  /** The LTF zone driving this setup */
  zone: ZoneData
  /** Score breakdown (all 7 dimensions) */
  scores: TradeFinderScoreBreakdown
  /** Entry price (zone proximal line) */
  entryPrice: number
  /** Computed SL: distalLine ± (ATR × 0.02 + spread) */
  stopLoss: number
  /** Computed TP: opposing fresh zone proximal or 2:1 fallback */
  takeProfit: number
  /** Risk in pips */
  riskPips: number
  /** Reward in pips */
  rewardPips: number
  /** R:R ratio string (e.g. "2.5:1") */
  rrRatio: string
  /** Position size in units (based on global risk %) */
  positionSize: number
  /** MTF trend data snapshot */
  trendData: TrendData | null
  /** HTF curve data snapshot */
  curveData: CurveData | null
  /** Distance from current price to entry in pips */
  distanceToEntryPips: number
  /** When this setup was first detected */
  detectedAt: string
  /** Last time scores were recalculated */
  lastUpdatedAt: string
  /** OANDA source trade/order ID if placed */
  resultSourceId: string | null
  /** Whether this setup was auto-placed (vs manual) */
  autoPlaced: boolean
  /** When the auto-trade order was placed */
  placedAt: string | null
}

/** Scanner status broadcast to clients */
export interface TradeFinderScanStatus {
  isScanning: boolean
  lastScanAt: string | null
  nextScanAt: string | null
  pairsScanned: number
  totalPairs: number
  activeSetups: number
  error: string | null
}

/** Trade Finder settings API response */
export interface TradeFinderConfigResponse {
  config: TradeFinderConfigData
  scanStatus: TradeFinderScanStatus
}
