// @fxflow/types — shared type contracts

// ─── Trading Mode ────────────────────────────────────────────────────────────

/** OANDA account environment — "live" for real money, "practice" for demo/paper trading. */
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

/**
 * Standard API response wrapper used across all REST endpoints.
 *
 * @typeParam T - The shape of the data payload (defaults to void for action-only endpoints).
 */
export interface ApiResponse<T = void> {
  /** Whether the request succeeded. */
  ok: boolean
  /** Response payload, present only on success. */
  data?: T
  /** Human-readable error message, present only on failure. */
  error?: string
}

// ─── Connection Status ──────────────────────────────────────────────────────

/** Extended status state including 'unconfigured' for when no credentials exist */
export type ConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "warning"
  | "unconfigured"

// ─── Market Status ──────────────────────────────────────────────────────────

/** Why the market is currently closed */
export type MarketCloseReason =
  | "weekend" // Fri 5PM ET → Sun 5PM ET
  | "rollover" // Daily 4:59 PM → 5:05 PM ET maintenance window
  | "holiday" // Inferred: non-tradeable outside normal maintenance hours
  | "paused" // Catch-all: OANDA reports non-tradeable for unknown reason

/** Current forex market status data, broadcast via WebSocket and displayed in the header. */
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

/** OANDA connection and account health data, checked periodically by the daemon. */
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

/** Aggregate daemon status snapshot sent to clients on initial WebSocket connection. */
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

/** Trade direction — "long" (buy) or "short" (sell). */
export type TradeDirection = "long" | "short"

/** Lifecycle status of a trade within the system. */
export type TradeStatus = "pending" | "open" | "closed"

/**
 * Display-enriched source of a trade. The raw DB value is always "oanda";
 * enrichment via `enrichSource()` maps metadata.placedVia to these labels.
 */
export type TradeSource =
  | "oanda"
  | "manual"
  | "automated"
  | "ut_bot_alerts"
  | "trade_finder"
  | "trade_finder_auto"
  | "ai_trader"
  | "ai_trader_manual"
  | "smart_flow"

/** OANDA order types, including dependent orders (SL/TP/TSL). */
export type OrderType =
  | "LIMIT"
  | "STOP"
  | "MARKET_IF_TOUCHED"
  | "MARKET"
  | "TAKE_PROFIT"
  | "STOP_LOSS"
  | "TRAILING_STOP_LOSS"

/** Reason an OANDA trade was closed, used for outcome classification and display. */
export type TradeCloseReason =
  | "MARKET_ORDER"
  | "STOP_LOSS_ORDER"
  | "TAKE_PROFIT_ORDER"
  | "TRAILING_STOP_LOSS_ORDER"
  | "MARGIN_CLOSEOUT"
  | "LINKED_TRADE_CLOSED"
  | "ORDER_CANCEL"
  | "REVERSAL"
  | "UNKNOWN"

/** Outcome classification of a closed trade, derived from realizedPL and exit state. */
export type TradeOutcome = "win" | "loss" | "breakeven" | "cancelled"

/** OANDA candlestick granularity identifiers (M = minutes, H = hours, D/W/M = day/week/month). */
export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D" | "W" | "M"

// ─── Pending Order Data ────────────────────────────────────────────────────

/** Data transfer object for a pending (unfilled) order, displayed in the Pending Orders table. */
export interface PendingOrderData {
  /** Internal DB ID. */
  id: string
  /** Enriched trade source for display. */
  source: TradeSource
  /** OANDA order ID (e.g., "12345"). */
  sourceOrderId: string
  /** OANDA instrument (e.g., "EUR_USD"). */
  instrument: string
  direction: TradeDirection
  orderType: OrderType
  /** Absolute number of units. */
  units: number
  /** Target entry price for the pending order. */
  entryPrice: number
  /** Stop loss price, or null if not set. */
  stopLoss: number | null
  /** Take profit price, or null if not set. */
  takeProfit: number | null
  /** Trailing stop distance in price units, or null if not set. */
  trailingStopDistance: number | null
  /** Time-in-force policy: GTC = Good 'Til Cancelled, GTD = Good 'Til Date, etc. */
  timeInForce: "GTC" | "GTD" | "GFD" | "FOK" | "IOC"
  /** ISO timestamp for GTD orders; null for other time-in-force types. */
  gtdTime: string | null
  /** User-assigned chart timeframe context. */
  timeframe: Timeframe | null
  /** User or AI notes attached to this order. */
  notes: string | null
  /** Tags assigned to this order. */
  tags: TradeTagData[]
  /** ISO timestamp when the order was created on OANDA. */
  createdAt: string
}

// ─── Open Trade Data ───────────────────────────────────────────────────────

/** Data transfer object for a currently open (filled) trade, displayed in the Open Trades table. */
export interface OpenTradeData {
  /** Internal DB ID. */
  id: string
  /** Enriched trade source for display. */
  source: TradeSource
  /** OANDA trade ID. */
  sourceTradeId: string
  /** OANDA instrument (e.g., "EUR_USD"). */
  instrument: string
  direction: TradeDirection
  /** Price at which the trade was filled. */
  entryPrice: number
  /** Latest bid/ask price from the stream; null before first tick. */
  currentPrice: number | null
  /** Stop loss price, or null if not set. */
  stopLoss: number | null
  /** Take profit price, or null if not set. */
  takeProfit: number | null
  /** Trailing stop distance in price units, or null if not set. */
  trailingStopDistance: number | null
  /** Units at trade open (before any partial closes). */
  initialUnits: number
  /** Remaining units after partial closes. */
  currentUnits: number
  /** Current unrealized P&L in account currency. */
  unrealizedPL: number
  /** Realized P&L from partial closes. */
  realizedPL: number
  /** Accumulated financing/swap charges. */
  financing: number
  /** Margin currently held for this trade. */
  marginUsed: number
  /** Max Favorable Excursion in pips (highest unrealized profit during trade) */
  mfe: number | null
  /** Max Adverse Excursion in pips (deepest unrealized loss during trade) */
  mae: number | null
  /** User-assigned chart timeframe context. */
  timeframe: Timeframe | null
  /** User or AI notes attached to this trade. */
  notes: string | null
  /** Tags assigned to this trade. */
  tags: TradeTagData[]
  /** ISO timestamp when the trade was opened on OANDA. */
  openedAt: string
}

// ─── Closed Trade Data ─────────────────────────────────────────────────────

/** Data transfer object for a closed trade, displayed in the Trade History table. */
export interface ClosedTradeData {
  /** Internal DB ID. */
  id: string
  /** Enriched trade source for display. */
  source: TradeSource
  /** OANDA trade ID. */
  sourceTradeId: string
  /** OANDA instrument (e.g., "EUR_USD"). */
  instrument: string
  direction: TradeDirection
  /** Price at which the trade was filled. */
  entryPrice: number
  /** Average exit price; null if not yet fully closed (partial). */
  exitPrice: number | null
  /** Stop loss price at time of close. */
  stopLoss: number | null
  /** Take profit price at time of close. */
  takeProfit: number | null
  /** Total units traded. */
  units: number
  /** Final realized P&L in account currency. */
  realizedPL: number
  /** Total financing/swap charges over the trade's lifetime. */
  financing: number
  /** What caused the trade to close. */
  closeReason: TradeCloseReason
  /** Rich context about the close — e.g., AI breakeven move that led to this SL hit. */
  closeContext: CloseContext | null
  /** Win/loss/breakeven classification. */
  outcome: TradeOutcome
  /** Max Favorable Excursion in pips (null for backfilled trades) */
  mfe: number | null
  /** Max Adverse Excursion in pips (null for backfilled trades) */
  mae: number | null
  /** User-assigned chart timeframe context. */
  timeframe: Timeframe | null
  /** User or AI notes attached to this trade. */
  notes: string | null
  /** Tags assigned to this trade. */
  tags: TradeTagData[]
  /** ISO timestamp when the trade was opened on OANDA. */
  openedAt: string
  /** ISO timestamp when the trade was closed on OANDA. */
  closedAt: string
}

/** Context stored on trade closure for attribution and audit trail.
 *  - AI breakeven: tracks when an AI condition moved SL to breakeven before the SL was hit.
 *  - Cancellation: tracks why a pending order was cancelled and by whom. */
export interface CloseContext {
  // ── AI Breakeven fields ──
  breakeven?: boolean
  conditionId?: string
  conditionLabel?: string
  createdBy?: "user" | "ai"
  movedAt?: string
  originalSL?: number
  bufferedSL?: number
  entryPrice?: number
  // ── Cancellation fields ──
  /** Who/what cancelled the order: "trade_finder", "user", "system", "ai_condition", "expired" */
  cancelledBy?: string
  /** Human-readable reason for the cancellation. */
  cancelReason?: string
  /** ISO timestamp when the cancellation was detected or executed. */
  cancelledAt?: string
}

// ─── Aggregate Positions Payload ───────────────────────────────────────────

/** Aggregate positions payload sent from daemon to connected web clients via WebSocket. */
export interface PositionsData {
  /** All pending (unfilled) orders. */
  pending: PendingOrderData[]
  /** All currently open (filled) trades. */
  open: OpenTradeData[]
  /** Today's closed trades only (forex day boundary) */
  closed: ClosedTradeData[]
  /** ISO timestamp of the last reconciliation cycle. */
  lastUpdated: string
}

// ─── Live Price Tick ───────────────────────────────────────────────────────

/** A single live price tick from the OANDA streaming API for an instrument with open positions. */
export interface PositionPriceTick {
  /** OANDA instrument (e.g., "EUR_USD"). */
  instrument: string
  /** Current bid price. */
  bid: number
  /** Current ask price. */
  ask: number
  /** ISO timestamp from OANDA. */
  time: string
}

/** Batch of live price ticks broadcast to connected clients via WebSocket. */
export interface PositionsPriceData {
  /** Array of price ticks, one per instrument that had a price update. */
  prices: PositionPriceTick[]
}

// ─── Positions Summary (for header pills) ──────────────────────────────────

/** Compact positions summary displayed in the header navigation pills. */
export interface PositionsSummary {
  /** Number of pending (unfilled) orders. */
  pendingCount: number
  /** Number of currently open trades. */
  openCount: number
  /** Number of trades closed today (forex day boundary: 5 PM ET). */
  closedTodayCount: number
  /** Winning trades closed today. */
  todayWins: number
  /** Losing trades closed today. */
  todayLosses: number
  /** Net realized P&L from trades closed today, in account currency. */
  todayNetPL: number
}

// ─── Tags ────────────────────────────────────────────────────────────────────

/** A user-defined tag for categorizing trades (e.g., "News", "Scalp", "Reversal"). */
export interface TagData {
  /** Unique tag ID. */
  id: string
  /** Display name of the tag. */
  name: string
  /** CSS-compatible color value for the tag badge. */
  color: string
}

/** A tag assignment on a specific trade, including the full tag data and assignment timestamp. */
export interface TradeTagData {
  /** ID of the assigned tag. */
  tagId: string
  /** Full tag details. */
  tag: TagData
  /** ISO timestamp when the tag was assigned to the trade. */
  assignedAt: string
}

// ─── Trade Actions ──────────────────────────────────────────────────────────

/** Request body for cancelling a pending order via the daemon. */
export interface CancelOrderRequest {
  /** OANDA order ID to cancel. */
  sourceOrderId: string
}

/** Request body for closing an open trade (full or partial) via the daemon. */
export interface CloseTradeRequest {
  /** OANDA trade ID to close. */
  sourceTradeId: string
  /** Omit or set to undefined for full close; specify units for partial close */
  units?: number
}

/** Request body for modifying SL/TP on an open trade via the daemon. */
export interface ModifyTradeRequest {
  /** OANDA trade ID to modify. */
  sourceTradeId: string
  /** null = remove SL; undefined = leave unchanged */
  stopLoss?: number | null
  /** null = remove TP; undefined = leave unchanged */
  takeProfit?: number | null
}

/**
 * Response wrapper for trade action endpoints (close, cancel, modify).
 *
 * @typeParam T - Shape of the optional data payload on success.
 */
export interface TradeActionResponse<T = unknown> {
  /** Whether the action succeeded. */
  ok: boolean
  /** Error message on failure. */
  error?: string
  /** Optional data payload on success. */
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
  placedVia?:
    | "fxflow"
    | "ut_bot_alerts"
    | "trade_finder"
    | "trade_finder_auto"
    | "ai_trader"
    | "ai_trader_manual"
    | "smart_flow"
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

/** A single event in a trade's timeline (e.g., order filled, SL modified, partial close). */
export interface TradeEventData {
  /** Event ID. */
  id: string
  /** Event type identifier (e.g., "ORDER_FILL", "STOP_LOSS_ORDER"). */
  eventType: string
  /** JSON-serialized event detail from OANDA transaction. */
  detail: string // JSON
  /** ISO timestamp when the event occurred. */
  createdAt: string
}

// ─── Trade Detail (for drawer) ───────────────────────────────────────────────

/** Full trade detail for the trade detail drawer, including timeline events and all fields. */
export interface TradeDetailData {
  /** Internal DB ID. */
  id: string
  /** Enriched trade source label. */
  source: string
  /** OANDA trade/order ID. */
  sourceTradeId: string
  /** Current lifecycle status ("pending" | "open" | "closed"). */
  status: string
  /** OANDA instrument (e.g., "EUR_USD"). */
  instrument: string
  /** Trade direction ("long" | "short"). */
  direction: string
  /** Order type, present only for pending orders. */
  orderType: string | null
  /** Entry/fill price. */
  entryPrice: number
  /** Exit price (null if still open or pending). */
  exitPrice: number | null
  /** Stop loss price, or null if not set. */
  stopLoss: number | null
  /** Take profit price, or null if not set. */
  takeProfit: number | null
  /** Trailing stop distance in price units, or null. */
  trailingStopDistance: number | null
  /** Units at trade open. */
  initialUnits: number
  /** Remaining units after partial closes. */
  currentUnits: number
  /** Realized P&L in account currency. */
  realizedPL: number
  /** Current unrealized P&L (0 for closed/pending). */
  unrealizedPL: number
  /** Accumulated financing/swap charges. */
  financing: number
  /** Close reason (null if not yet closed). */
  closeReason: string | null
  /** Rich context about the close — e.g., AI breakeven move that led to this SL hit. */
  closeContext: CloseContext | null
  /** Time-in-force for pending orders. */
  timeInForce: string | null
  /** GTD expiry time for pending orders. */
  gtdTime: string | null
  /** Max Favorable Excursion in pips. */
  mfe: number | null
  /** Max Adverse Excursion in pips. */
  mae: number | null
  /** User or AI notes. */
  notes: string | null
  /** User-assigned chart timeframe context. */
  timeframe: Timeframe | null
  /** ISO timestamp when opened on OANDA. */
  openedAt: string
  /** ISO timestamp when closed on OANDA, or null if still active. */
  closedAt: string | null
  /** Tags assigned to this trade. */
  tags: TradeTagData[]
  /** Chronological event timeline for this trade. */
  events: TradeEventData[]
}

// ─── Notifications ──────────────────────────────────────────────────────────

/** Notification urgency level, determines visual styling and sort priority. */
export type NotificationSeverity = "critical" | "warning" | "info"

/** Subsystem that generated the notification, used for filtering and deep-link routing. */
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
  | "ai_trader"
  | "price_alert"
  | "smart_flow"
  | "source_priority"

/** A notification displayed in the header notification panel. */
export interface NotificationData {
  /** Unique notification ID. */
  id: string
  /** Urgency level. */
  severity: NotificationSeverity
  /** Subsystem that generated this notification. */
  source: NotificationSource
  /** Short notification title. */
  title: string
  /** Detailed notification message. */
  message: string
  /** Optional JSON metadata for deep links (e.g. { analysisId, tradeId }) */
  metadata: string | null
  /** Whether the user has dismissed this notification. */
  dismissed: boolean
  /** ISO timestamp when the notification was created. */
  createdAt: string
}

/** Paginated notification list response from the notifications API. */
export interface NotificationListResponse {
  /** Notifications for the current page. */
  notifications: NotificationData[]
  /** Total notifications matching the query. */
  totalCount: number
  /** Count of undismissed notifications (for badge display). */
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

/** Discriminator values for all WebSocket messages sent from the daemon to connected clients. */
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
  | "trade_finder_cap_utilization"
  // Price Alerts
  | "price_alert_triggered"
  // AI Trader
  | "ai_trader_opportunity_found"
  | "ai_trader_opportunity_updated"
  | "ai_trader_opportunity_removed"
  | "ai_trader_scan_status"
  | "ai_trader_scan_progress"
  | "ai_trader_scan_log_entry"
  | "ai_trader_trade_placed"
  | "ai_trader_trade_managed"
  | "ai_trader_trade_closed"
  // SmartFlow
  | "smart_flow_status"
  | "smart_flow_trade_update"
  | "smart_flow_entry_triggered"
  | "smart_flow_safety_alert"
  | "smart_flow_ai_suggestion"
  // Source Priority
  | "source_priority_event"

/**
 * Base WebSocket message envelope sent from daemon to clients.
 * All messages include a type discriminator, ISO timestamp, and typed data payload.
 *
 * @typeParam T - Shape of the data payload.
 */
export interface DaemonMessage<T = unknown> {
  /** Message type discriminator for client-side routing. */
  type: DaemonMessageType
  /** ISO timestamp when the message was created. */
  timestamp: string
  /** Typed data payload. */
  data: T
}

/** Sent on initial WebSocket connection with a full daemon state snapshot. */
export interface StatusSnapshotMessage extends DaemonMessage<DaemonStatusSnapshot> {
  type: "status_snapshot"
}

/** Broadcast when OANDA health status changes (connection, margin, etc.). */
export interface OandaUpdateMessage extends DaemonMessage<OandaHealthData> {
  type: "oanda_update"
}

/** Broadcast when market open/close status changes. */
export interface MarketUpdateMessage extends DaemonMessage<MarketStatusData> {
  type: "market_update"
}

/** Sent when the daemon encounters an error that should be surfaced to clients. */
export interface DaemonErrorMessage extends DaemonMessage<{ message: string; code?: string }> {
  type: "error"
}

/** Broadcast when a new notification is created (triggers toast + badge update). */
export interface NotificationCreatedMessage extends DaemonMessage<NotificationData> {
  type: "notification_created"
}

/** Broadcast when account overview data is refreshed from OANDA. */
export interface AccountOverviewUpdateMessage extends DaemonMessage<AccountOverviewData> {
  type: "account_overview_update"
}

/** Broadcast after each reconciliation cycle with updated positions. */
export interface PositionsUpdateMessage extends DaemonMessage<PositionsData> {
  type: "positions_update"
}

/** High-frequency price tick updates for instruments with open positions. */
export interface PositionsPriceUpdateMessage extends DaemonMessage<PositionsPriceData> {
  type: "positions_price_update"
}

/** Price tick updates for instruments displayed on chart pages (subscribed per-panel). */
export interface ChartPriceUpdateMessage extends DaemonMessage<PositionsPriceData> {
  type: "chart_price_update"
}

/** Broadcast when a TradingView alert signal is received and processed. */
export interface TVAlertSignalMessage extends DaemonMessage<TVAlertSignal> {
  type: "tv_alert_signal"
}

/** Broadcast when TV Alerts module status changes (enable/disable, circuit breaker, etc.). */
export interface TVAlertsStatusMessage extends DaemonMessage<TVAlertsStatusData> {
  type: "tv_alerts_status"
}

/** Broadcast when an AI analysis begins execution. */
export interface AiAnalysisStartedMessage extends DaemonMessage<{
  analysisId: string
  tradeId: string
  model: string
  depth: string
}> {
  type: "ai_analysis_started"
}

/** Streamed progress updates during AI analysis (stage changes, token chunks). */
export interface AiAnalysisUpdateMessage extends DaemonMessage<{
  analysisId: string
  tradeId: string
  stage?: string
  progress?: number
  chunk?: string
}> {
  type: "ai_analysis_update"
}

/** Broadcast when an AI analysis finishes (success or failure). */
export interface AiAnalysisCompletedMessage extends DaemonMessage<{
  analysisId: string
  tradeId: string
  sections: AiAnalysisSections | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  error?: string
}> {
  type: "ai_analysis_completed"
}

/** Broadcast when auto-analysis is disabled due to repeated failures. */
export interface AiAutoAnalysisDisabledMessage extends DaemonMessage<{
  reason: string
  disabledAt: string
  lastFailureMessage: string
}> {
  type: "ai_auto_analysis_disabled"
}

/** Broadcast when a trade condition triggers (SL move, close, notification, etc.). */
export interface ConditionTriggeredMessage extends DaemonMessage<{
  conditionId: string
  tradeId: string
  instrument: string
  label: string | null
  actionType: string
  success: boolean
  error?: string
}> {
  type: "condition_triggered"
}

/** Broadcast when Trade Finder detects a new setup. */
export interface TradeFinderSetupFoundMessage extends DaemonMessage<TradeFinderSetupData> {
  type: "trade_finder_setup_found"
}

/** Broadcast when a Trade Finder setup's scores or status change. */
export interface TradeFinderSetupUpdatedMessage extends DaemonMessage<TradeFinderSetupData> {
  type: "trade_finder_setup_updated"
}

/** Broadcast when a Trade Finder setup is removed (expired, invalidated). */
export interface TradeFinderSetupRemovedMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  reason: string
}> {
  type: "trade_finder_setup_removed"
}

/** Broadcast with scanner progress after each Trade Finder scan cycle. */
export interface TradeFinderScanStatusMessage extends DaemonMessage<TradeFinderScanStatus> {
  type: "trade_finder_scan_status"
}

/** Broadcast when Trade Finder auto-trade places a limit order on OANDA. */
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

/** Broadcast when a Trade Finder auto-placed order is cancelled (zone invalidation, external cancel). */
export interface TradeFinderAutoTradeCancelledMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  reason: string
  sourceOrderId: string
}> {
  type: "trade_finder_auto_trade_cancelled"
}

/** Broadcast when a Trade Finder auto-placed order is filled on OANDA. */
export interface TradeFinderAutoTradeFilledMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  direction: TradeDirection
  sourceId: string
  score: number
}> {
  type: "trade_finder_auto_trade_filled"
}

/** Broadcast when a Trade Finder setup is skipped for auto-trade (risk gate, score too low). */
export interface TradeFinderAutoTradeSkippedMessage extends DaemonMessage<{
  setupId: string
  instrument: string
  direction: TradeDirection
  score: number
  reason: string
}> {
  type: "trade_finder_auto_trade_skipped"
}

/** Broadcast current auto-trade cap utilization to clients. */
export interface TradeFinderCapUtilizationMessage extends DaemonMessage<TradeFinderCapUtilization> {
  type: "trade_finder_cap_utilization"
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

/** Discriminated union of all possible WebSocket messages from the daemon. Used for type-safe message handling. */
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
  | TradeFinderCapUtilizationMessage
  | AiTraderOpportunityFoundMessage
  | AiTraderOpportunityUpdatedMessage
  | AiTraderOpportunityRemovedMessage
  | AiTraderScanStatusMessage
  | AiTraderScanProgressMessage
  | AiTraderScanLogEntryMessage
  | AiTraderTradePlacedMessage
  | AiTraderTradeManagedMessage
  | AiTraderTradeClosedMessage
  | PriceAlertTriggeredMessage
  | SmartFlowStatusMessage
  | SmartFlowTradeUpdateMessage
  | SmartFlowEntryTriggeredMessage
  | SmartFlowSafetyAlertMessage
  | SmartFlowAiSuggestionMessage
  | SourcePriorityEventMessage

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
  /** Unique signal ID assigned by CF Worker for idempotent processing */
  signalId?: string
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
/** Aggregate performance statistics for TradingView alert signals. */
export interface TVSignalPerformanceStats {
  /** Total signals received. */
  totalSignals: number
  /** Signals that were successfully executed as trades. */
  executedSignals: number
  /** Signals that were rejected (duplicate, cooldown, risk limit, etc.). */
  rejectedSignals: number
  /** Signals that failed during execution. */
  failedSignals: number
  /** Winning trades from signals. */
  wins: number
  /** Losing trades from signals. */
  losses: number
  /** Breakeven trades from signals. */
  breakeven: number
  /** Win rate percentage (0-100). */
  winRate: number
  /** Total realized P&L from signal-originated trades. */
  totalPL: number
  /** Average P&L of winning trades. */
  averageWin: number
  /** Average P&L of losing trades (negative). */
  averageLoss: number
  /** Profit factor (gross wins / gross losses). */
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

/** Period-based P&L breakdown for TV alerts, keyed by time period. */
export type TVSignalPeriodPnLData = Record<PnLPeriod, TVSignalPeriodPnL>

/** A single bucket in a P&L distribution histogram. */
export interface TVSignalPnLBucket {
  /** Lower bound of the bucket (inclusive). */
  min: number
  /** Upper bound of the bucket (exclusive). */
  max: number
  /** Human-readable label (e.g., "$-20 to $-10"). */
  label: string
  /** Number of trades in this bucket. */
  count: number
}

/** A recent signal trade result for the activity feed. */
export interface TVSignalRecentResult {
  /** Signal ID. */
  signalId: string
  /** OANDA instrument (e.g., "EUR_USD"). */
  instrument: string
  /** Trade direction. */
  direction: TVSignalDirection
  /** Realized P&L (net of financing). */
  realizedPL: number
  /** When the signal was processed. */
  processedAt: string
}

/** Signal volume and outcome breakdown for a single instrument. */
export interface TVSignalPairStats {
  /** OANDA instrument (e.g., "EUR_USD"). */
  instrument: string
  /** Total signals received for this pair. */
  total: number
  /** Signals that were executed. */
  executed: number
  /** Signals that were rejected or skipped. */
  rejected: number
  /** Signals that failed. */
  failed: number
  /** Buy signals count. */
  buys: number
  /** Sell signals count. */
  sells: number
}

/** Combined detailed stats returned by the /api/tv-alerts/stats/detailed endpoint. */
export interface TVAlertsDetailedStats {
  /** P&L distribution histogram buckets. */
  distribution: TVSignalPnLBucket[]
  /** Most recent closed signal trade results. */
  recentResults: TVSignalRecentResult[]
  /** Signal volume breakdown by instrument. */
  signalsByPair: TVSignalPairStats[]
}

// ─── CF Worker ↔ Daemon Messages ───────────────────────────────────────────

/** CF Worker → Daemon message types */
export type CFWorkerMessageType = "signal" | "heartbeat" | "queued_signals"

/**
 * WebSocket message envelope from the Cloudflare Worker to the daemon.
 *
 * @typeParam T - Shape of the data payload.
 */
export interface CFWorkerMessage<T = unknown> {
  /** Message type discriminator. */
  type: CFWorkerMessageType
  /** ISO timestamp. */
  timestamp: string
  /** Typed data payload. */
  data: T
}

/** Daemon → CF Worker message types */
export type DaemonToCFMessageType = "authenticate" | "signal_ack" | "status"

/**
 * WebSocket message envelope from the daemon to the Cloudflare Worker.
 *
 * @typeParam T - Shape of the data payload.
 */
export interface DaemonToCFMessage<T = unknown> {
  /** Message type discriminator. */
  type: DaemonToCFMessageType
  /** ISO timestamp. */
  timestamp: string
  /** Typed data payload. */
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

/** Lifecycle status of an AI analysis request. */
export type AiAnalysisStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

/** Analysis depth preset — controls prompt complexity and context window usage. */
export type AiAnalysisDepth = "quick" | "standard" | "deep"

/** What triggered the analysis — manual user request or one of the auto-analysis triggers. */
export type AiAnalysisTriggeredBy =
  | "user"
  | "auto_pending"
  | "auto_fill"
  | "auto_close"
  | "auto_interval"

/** Supported Claude model identifiers for AI analysis. */
export type AiClaudeModel = "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" | "claude-opus-4-6"

/** Model option metadata for the model selector UI and cost estimation. */
export interface AiModelOption {
  /** Claude model identifier. */
  id: AiClaudeModel
  /** Human-readable model name (e.g., "Haiku -- Quick"). */
  name: string
  /** Brief description of the model's analysis style. */
  description: string
  /** Cost per 1M input tokens in USD. */
  inputCostPer1M: number
  /** Cost per 1M output tokens in USD. */
  outputCostPer1M: number
  /** Typical analysis duration in seconds for UI progress indicators. */
  estimatedDurationSec: number
}

/** Available Claude model options with pricing and estimated durations. Used by settings UI, model selector, and cost calculation. */
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

/** Types of immediate actions the AI can recommend after analysis. */
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

/** An actionable recommendation from the AI, rendered as a button in the analysis results. */
export interface AiActionButton {
  /** Unique action ID (used for auto-apply tracking). */
  id: string
  /** Action type determining which dialog/operation to invoke. */
  type: AiActionButtonType
  /** Short button label (e.g., "Move SL to 1.0850"). */
  label: string
  /** Longer description of the action and its rationale. */
  description: string
  /** Pre-computed params for pre-filling existing dialogs */
  params: Record<string, unknown>
  /** AI confidence level for this recommendation. */
  confidence: "high" | "medium" | "low"
  /** Detailed reasoning for the recommendation. */
  rationale: string
}

/** AI-suggested trade condition (converted to TradeCondition if accepted or auto-applied). */
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

/** A key price level identified by the AI during analysis. */
export interface AiKeyLevel {
  /** Price level value. */
  price: number
  /** Descriptive label (e.g., "Daily R1", "Previous week high"). */
  label: string
  /** Level classification. */
  type: "support" | "resistance" | "pivot"
}

/** An upcoming or recent economic news event relevant to the analyzed trade. */
export interface AiNewsEvent {
  /** Event title (e.g., "US Non-Farm Payrolls"). */
  title: string
  /** ISO timestamp of the event. */
  time: string
  /** Affected currency code (e.g., "USD"). */
  currency: string
  /** Expected market impact level. */
  impact: "low" | "medium" | "high"
  /** Consensus forecast value. */
  forecast?: string
  /** Previous release value. */
  previous?: string
}

/** Structured sections of an AI analysis result. Produced by the analysis executor and displayed in the AI sheet. */
export interface AiAnalysisSections {
  /** One-paragraph executive summary of the trade assessment. */
  summary: string
  /** Estimated probability of the trade being profitable (0-100). */
  winProbability: number
  /** Overall trade quality score (0-100). */
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
  /** Technical analysis section. */
  technical: {
    /** Current trend assessment. */
    trend: string
    /** Key support/resistance/pivot levels near current price. */
    keyLevels: AiKeyLevel[]
    /** Summary of indicator readings (RSI, MACD, etc.). */
    indicators: string
    /** Identified candlestick patterns. */
    candlePatterns: string
    /** Momentum assessment. */
    momentum: string
    /** Educational explanation (only when learning mode enabled) */
    educational?: string
  }
  /** Risk assessment section. */
  risk: {
    /** Overall risk level classification. */
    assessment: "low" | "medium" | "high" | "very_high"
    /** Individual risk factors identified. */
    factors: string[]
    /** Analysis of the trade's risk/reward profile. */
    riskRewardAnalysis: string
    /** Comment on position sizing appropriateness. */
    positionSizingComment: string
    /** Educational explanation (only when learning mode enabled). */
    educational?: string
  }
  /** Portfolio-level risk assessment */
  portfolioRisk?: {
    correlatedExposure: string | null
    totalRiskPercent: string
    concentrationWarning: string | null
  }
  /** Market context and session analysis section. */
  marketContext: {
    /** Current trading session (e.g., "London/NY Overlap"). */
    currentSession: string
    /** Volatility assessment. */
    volatility: string
    /** Upcoming or recent high-impact news events. */
    newsEvents: AiNewsEvent[]
    /** Correlation analysis with related pairs/assets. */
    correlations: string
    /** Market sentiment note. */
    sentimentNote: string
    /** Educational explanation (only when learning mode enabled). */
    educational?: string
  }
  /** Historical trade performance analysis for this instrument. */
  tradeHistory: {
    /** Win rate for this currency pair. */
    pairWinRate: string
    /** Average risk/reward ratio for this pair. */
    averageRR: string
    /** Commonly observed patterns. */
    commonPatterns: string
    /** Recent performance summary. */
    recentPerformance: string
    /** Educational explanation (only when learning mode enabled). */
    educational?: string
  }
  /** Bullet-point recommendations for managing this trade. */
  recommendations: string[]
  /** Actionable buttons for immediate trade modifications. */
  immediateActions: AiActionButton[]
  /** Suggested trade conditions for automated management. */
  conditionSuggestions: AiConditionSuggestion[]
  /** Post-mortem analysis for closed trades (lessons learned). */
  postMortem?: string
  /** Action IDs that were auto-executed by the daemon (set post-analysis, not by AI) */
  autoAppliedActionIds?: string[]
}

/** Complete AI analysis record, persisted in the database and returned by the analysis API. */
export interface AiAnalysisData {
  /** Analysis ID. */
  id: string
  /** ID of the trade that was analyzed. */
  tradeId: string
  /** Current analysis lifecycle status. */
  status: AiAnalysisStatus
  /** Depth preset used for this analysis. */
  depth: AiAnalysisDepth
  /** Claude model used. */
  model: AiClaudeModel
  /** Trade status at the time of analysis ("pending" | "open" | "closed"). */
  tradeStatus: string
  /** What triggered this analysis. */
  triggeredBy: AiAnalysisTriggeredBy
  /** Structured analysis sections; null if not yet completed or failed. */
  sections: AiAnalysisSections | null
  /** Total input tokens consumed. */
  inputTokens: number
  /** Total output tokens generated. */
  outputTokens: number
  /** Total cost in USD. */
  costUsd: number
  /** Execution duration in milliseconds. */
  durationMs: number
  /** Error message if the analysis failed. */
  errorMessage: string | null
  /** ISO timestamp when the analysis was created. */
  createdAt: string
  /** ISO timestamp of the last status update. */
  updatedAt: string
}

/** Aggregate AI usage statistics displayed on the AI settings page. */
export interface AiUsageStats {
  /** Total number of analyses run (all statuses). */
  totalAnalyses: number
  /** Cumulative input tokens across all analyses. */
  totalInputTokens: number
  /** Cumulative output tokens across all analyses. */
  totalOutputTokens: number
  /** Cumulative cost in USD. */
  totalCostUsd: number
  /** Average win probability across completed analyses; null if none. */
  avgWinProbability: number | null
  /** Average quality score across completed analyses; null if none. */
  avgQualityScore: number | null
  /** Number of auto-triggered analyses. */
  autoCount: number
  /** Number of manually triggered analyses. */
  manualCount: number
  /** Usage breakdown by Claude model. */
  byModel: Array<{
    model: string
    count: number
    inputTokens: number
    outputTokens: number
    costUsd: number
  }>
  /** Usage breakdown by time period. */
  byPeriod: {
    today: { count: number; costUsd: number }
    thisWeek: { count: number; costUsd: number }
    thisMonth: { count: number; costUsd: number }
    thisYear: { count: number; costUsd: number }
    allTime: { count: number; costUsd: number }
  }
  /** Count of analyses by status. */
  statusCounts: {
    completed: number
    failed: number
    cancelled: number
    running: number
    pending: number
  }
}

/** Configuration for automated AI analysis triggers and behavior. */
export interface AiAutoAnalysisSettings {
  /** Master auto-analysis toggle. */
  enabled: boolean
  /** Trigger analysis when a new pending order is created. */
  onPendingCreate: boolean
  /** Trigger analysis when a pending order fills. */
  onOrderFill: boolean
  /** Trigger analysis when a trade closes (post-mortem). */
  onTradeClose: boolean
  /** Enable periodic re-analysis of open trades. */
  intervalEnabled: boolean
  /** Hours between periodic re-analyses. */
  intervalHours: number
  /** Default analysis depth for auto-triggered analyses. */
  defaultDepth: AiAnalysisDepth
  /** Default Claude model for auto-triggered analyses. */
  defaultModel: AiClaudeModel
  /** Whether to auto-apply AI recommendations on live accounts. */
  liveAutoApplyEnabled: boolean
  /** Whether to auto-apply AI recommendations on practice accounts. */
  practiceAutoApplyEnabled: boolean
  /** Minimum confidence level for auto-applying actions */
  autoApplyMinConfidence: "high" | "medium" | "low"
  /** Automatically create conditions suggested by AI after analysis completes */
  autoApplyConditions: boolean
  /** Minimum confidence level for auto-applying condition suggestions */
  autoApplyMinConditionConfidence: "high" | "medium" | "low"
  /** Minimum confidence for auto-applying SL-modifying conditions (breakeven, move SL).
   *  Defaults to "high" — SL changes directly affect risk so require higher bar. */
  autoApplyMinSLConditionConfidence: "high" | "medium" | "low"
  /** Send a notification when auto-analysis completes. */
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

/** Default auto-analysis settings applied when no user configuration exists. */
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
  autoApplyMinSLConditionConfidence: "high",
  notifyOnComplete: true,
  learningMode: false,
  digestEnabled: false,
  digestFrequency: "weekly",
}

/** AI settings response from GET /api/ai/settings. Contains API key status (never raw keys) and auto-analysis config. */
export interface AiSettingsData {
  /** Whether a Claude API key is configured. */
  hasClaudeKey: boolean
  /** Last 4 characters of the Claude API key for display. */
  claudeKeyLastFour: string
  /** Whether a Finnhub API key is configured (for news data). */
  hasFinnhubKey: boolean
  /** Last 4 characters of the Finnhub API key for display. */
  finnhubKeyLastFour: string
  /** Default Claude model for manual analyses. */
  defaultModel: AiClaudeModel
  /** Auto-analysis configuration. */
  autoAnalysis: AiAutoAnalysisSettings
}

// ─── AI Accuracy & Digest ────────────────────────────────────────────────────

/** AI prediction accuracy statistics comparing predicted vs actual outcomes. */
export interface AiAccuracyStats {
  /** Total AI recommendations tracked. */
  totalRecommendations: number
  /** Recommendations that the user followed. */
  followedCount: number
  /** Recommendations that the user ignored. */
  ignoredCount: number
  /** Win rate of followed recommendations; null if insufficient data. */
  followedWinRate: number | null
  /** Win rate of ignored recommendations; null if insufficient data. */
  ignoredWinRate: number | null
  /** Average AI-predicted win probability across all recommendations. */
  overallPredictedWinRate: number | null
  /** Actual win rate across all recommendations. */
  overallActualWinRate: number | null
  /** Calibration buckets comparing predicted vs actual win rates. */
  calibration: Array<{
    /** Bucket label (e.g., "60-70%"). */
    bucket: string
    /** Average predicted win rate in this bucket. */
    predictedAvg: number
    /** Actual win rate for trades in this bucket; null if insufficient data. */
    actualWinRate: number | null
    /** Number of trades in this bucket. */
    count: number
  }>
}

/** Structured sections of a periodic trading performance digest generated by AI. */
export interface AiDigestSections {
  /** Executive summary of the period's trading performance. */
  periodSummary: string
  /** Total trades closed during the period. */
  totalTrades: number
  /** Win rate for the period (0-100). */
  winRate: number
  /** Total net P&L for the period in account currency. */
  totalPnl: number
  /** Best performing currency pair during the period; null if no trades. */
  bestPair: { instrument: string; pnl: number; trades: number } | null
  /** Worst performing currency pair during the period; null if no trades. */
  worstPair: { instrument: string; pnl: number; trades: number } | null
  /** Best performing trading session; null if insufficient data. */
  bestSession: string | null
  /** Worst performing trading session; null if insufficient data. */
  worstSession: string | null
  /** Recurring positive patterns observed. */
  patterns: string[]
  /** Common mistakes identified. */
  mistakes: string[]
  /** Suggested improvements for the next period. */
  improvements: string[]
  /** Assessment of risk management practices. */
  riskManagement: string
  /** Observed emotional trading patterns; null if not detectable. */
  emotionalPatterns: string | null
  /** Suggested goal for the next trading period. */
  goalSuggestion: string
}

/** Complete periodic trading digest record, persisted in the database. */
export interface AiDigestData {
  /** Digest ID. */
  id: string
  /** Digest period type. */
  period: "weekly" | "monthly"
  /** ISO timestamp of the period start. */
  periodStart: string
  /** ISO timestamp of the period end. */
  periodEnd: string
  /** Digest generation status. */
  status: string
  /** Structured digest sections; null if not yet completed or failed. */
  sections: AiDigestSections | null
  /** Cost of generating this digest in USD. */
  costUsd: number
  /** Generation duration in milliseconds. */
  durationMs: number
  /** ISO timestamp when the digest was created. */
  createdAt: string
}

// ─── Trade Conditions ─────────────────────────────────────────────────────────

/** What event triggers a trade condition (price, P&L, time-based). */
export type TradeConditionTriggerType =
  | "price_reaches"
  | "price_breaks_above"
  | "price_breaks_below"
  | "pnl_pips"
  | "pnl_currency"
  | "time_reached"
  | "duration_hours"
  | "trailing_stop"

/** What action to take when a trade condition triggers. */
export type TradeConditionActionType =
  | "close_trade"
  | "partial_close"
  | "move_stop_loss"
  | "move_take_profit"
  | "cancel_order"
  | "notify"

/** Lifecycle status of a trade condition. */
export type TradeConditionStatus =
  | "active"
  | "waiting"
  | "executing"
  | "triggered"
  | "expired"
  | "cancelled"

/** A conditional rule attached to a trade, monitored by the daemon's ConditionMonitor. */
export interface TradeConditionData {
  /** Condition ID. */
  id: string
  /** ID of the trade this condition is attached to. */
  tradeId: string
  /** What triggers this condition. */
  triggerType: TradeConditionTriggerType
  /** Trigger parameters (e.g., { price: 1.0850 } or { pips: 50 }). */
  triggerValue: Record<string, unknown>
  /** Action to execute when triggered. */
  actionType: TradeConditionActionType
  /** Action parameters (e.g., { units: 5000 } for partial close). */
  actionParams: Record<string, unknown>
  /** Current condition lifecycle status. */
  status: TradeConditionStatus
  /** Optional human-readable label (e.g., "Move SL to breakeven at +50 pips"). */
  label: string | null
  /** Who created this condition. */
  createdBy: "user" | "ai"
  /** AI analysis ID that suggested this condition; null if user-created. */
  analysisId: string | null
  /** Execution priority (lower = higher priority when multiple conditions trigger). */
  priority: number
  /** Parent condition ID for chained conditions; null if standalone. */
  parentConditionId: string | null
  /** ISO timestamp when this condition expires; null for no expiry. */
  expiresAt: string | null
  /** ISO timestamp when this condition was triggered; null if not yet triggered. */
  triggeredAt: string | null
  /** ISO timestamp when the condition was created. */
  createdAt: string
  /** ISO timestamp of the last status update. */
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
export const TIMEFRAME_SET_MAP: Record<
  TradeFinderTimeframeSet,
  { htf: string; mtf: string; ltf: string }
> = {
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
  | "active" // Valid setup, price not yet near entry
  | "approaching" // Price within configurable distance of entry
  | "placed" // Order placed from this setup (pending on OANDA)
  | "filled" // Placed order has been filled on OANDA
  | "invalidated" // Zone broken or conditions no longer met
  | "expired" // Removed after timeout or scan cycle

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
  /** Why auto-trade was skipped on the most recent attempt (null = never skipped or eligible) */
  lastSkipReason: string | null
  /** Queue position when eligible but capped (null = not queued, 1 = next to be placed) */
  queuePosition: number | null
}

/** Auto-trade cap utilization snapshot */
export interface TradeFinderCapUtilization {
  concurrent: { used: number; max: number }
  risk: { usedPercent: number; maxPercent: number }
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

// ─── AI Trader ────────────────────────────────────────────────────────────────

/** AI Trader operating mode — controls how opportunities are handled after detection. */
export type AiTraderOperatingMode = "manual" | "semi_auto" | "full_auto"

/** AI Trader strategy profile — each has different timeframe, hold time, and risk characteristics. */
export type AiTraderProfile = "scalper" | "intraday" | "swing" | "news"

/** Lifecycle status of an AI Trader opportunity from detection through closure. */
export type AiTraderOpportunityStatus =
  | "detected" // Tier 1 found candidate
  | "suggested" // Tier 2/3 analyzed, awaiting approval
  | "approved" // User approved in Manual mode
  | "placed" // Order placed on OANDA
  | "filled" // Order filled, now an open trade
  | "managed" // Being actively managed (SL/TP adjustments)
  | "closed" // Trade closed (win/loss/breakeven)
  | "expired" // Opportunity expired before action
  | "rejected" // User rejected or AI below threshold
  | "skipped" // Skipped by risk gate (budget, correlation, max trades)

/** Technical analysis techniques used by the AI Trader's Tier 1 local analysis. */
export type AiTraderTechnique =
  | "smc_structure" // BOS/CHoCH market structure
  | "fair_value_gap" // FVG detection
  | "order_block" // Order block zones
  | "liquidity_sweep" // Equal H/L + session liquidity
  | "supply_demand_zone" // S/D zones (reuse zone-detector)
  | "fibonacci_ote" // Fibonacci OTE (62-79%)
  | "rsi" // RSI overbought/oversold
  | "macd" // MACD crossover + histogram
  | "ema_alignment" // 20/50/200 EMA trend alignment
  | "bollinger_bands" // Mean reversion extremes
  | "williams_r" // Williams %R momentum
  | "adx_regime" // ADX trend strength / regime
  | "divergence" // RSI/MACD divergence
  | "trend_detection" // Reuse existing trend-detector

/** Market regime classification detected by the ADX/ATR regime detector. */
export type AiTraderMarketRegime = "trending" | "ranging" | "volatile" | "low_volatility"

/** Forex trading session identifiers used for session-aware analysis and filtering. */
export type AiTraderSession =
  | "asian"
  | "london"
  | "ny"
  | "london_ny_overlap"
  | "london_close"
  | "off_session"

/** Types of external market data the AI Trader can fetch and cache. */
export type AiTraderMarketDataType =
  | "economic_calendar"
  | "news_sentiment"
  | "fred_macro"
  | "cot_positioning"
  | "correlation_matrix"

/** AI Trader configuration (singleton) */
export interface AiTraderConfigData {
  enabled: boolean
  operatingMode: AiTraderOperatingMode
  scanIntervalMinutes: number
  confidenceThreshold: number // For semi-auto/full-auto execution
  minimumConfidence: number // Below this, never suggest
  maxConcurrentTrades: number
  pairWhitelist: string[] // Empty = all pairs
  enabledProfiles: Record<AiTraderProfile, boolean>
  enabledTechniques: Record<AiTraderTechnique, boolean>
  managementConfig: AiTraderManagementConfig
  reEvalIntervalMinutes: number
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  scanModel: string // Claude model for Tier 2 scans
  decisionModel: string // Claude model for Tier 3 decisions
  fredApiKey: boolean // Has key (never expose raw)
  alphaVantageApiKey: boolean // Has key
}

/** Trade management rules applied after entry */
export interface AiTraderManagementConfig {
  breakevenEnabled: boolean
  breakevenTriggerRR: number // Move to BE when trade moves this many R in favor (e.g., 1.0)
  trailingStopEnabled: boolean
  trailingStopAtrMultiplier: number // Trail by N x ATR
  partialCloseEnabled: boolean
  partialClosePercent: number // % to close at first target
  partialCloseTargetRR: number // R:R level for first partial
  timeExitEnabled: boolean
  timeExitHours: number // Close if no movement after N hours
  newsProtectionEnabled: boolean // Tighten/close before high-impact events
  reEvaluationEnabled: boolean // Periodic AI re-evaluation of open trades
  scaleInEnabled: boolean // Allow adding to winning positions
}

/** Score breakdown for an AI Trader opportunity */
export interface AiTraderScoreBreakdown {
  technical: number // 0-100: indicator/pattern confluence
  fundamental: number // 0-100: macro/calendar/COT alignment
  sentiment: number // 0-100: news sentiment
  session: number // 0-100: session appropriateness
  historical: number // 0-100: past performance for this setup type
  confluence: number // 0-100: overall multi-technique alignment
}

/** Full opportunity data for an AI-discovered trade setup */
export interface AiTraderOpportunityData {
  id: string
  instrument: string
  direction: TradeDirection
  profile: AiTraderProfile
  status: AiTraderOpportunityStatus
  confidence: number // 0-100 overall confidence
  scores: AiTraderScoreBreakdown
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPips: number
  rewardPips: number
  riskRewardRatio: number
  positionSize: number // Units
  regime: AiTraderMarketRegime | null
  session: AiTraderSession | null
  primaryTechnique: AiTraderTechnique | null
  entryRationale: string | null // Human-readable explanation
  technicalSnapshot: unknown // Indicators, zones, structure at detection time
  fundamentalSnapshot: unknown // Macro, calendar, COT data
  sentimentSnapshot: unknown // News sentiment data
  tier2Response: string | null // Haiku quick scan response
  tier2Model: string | null // Claude model used for scan
  tier2InputTokens: number // Input tokens for quick scan
  tier2OutputTokens: number // Output tokens for quick scan
  tier2Cost: number // Cost of the quick scan
  tier3Response: string | null // Deep analysis response
  tier3Model: string | null // Claude model used for decision
  tier3InputTokens: number // Input tokens for deep analysis
  tier3OutputTokens: number // Output tokens for deep analysis
  tier3Cost: number // Cost of the deep analysis
  resultTradeId: string | null // DB trade ID once placed
  resultSourceId: string | null // OANDA order/trade ID
  realizedPL: number | null // Final P&L once closed
  outcome: TradeOutcome | null // Win/loss/breakeven
  managementLog: AiTraderManagementAction[]
  detectedAt: string // ISO timestamp
  suggestedAt: string | null
  placedAt: string | null
  filledAt: string | null
  closedAt: string | null
  expiresAt: string | null
}

/** A management action taken on an AI trade */
export interface AiTraderManagementAction {
  action:
    | "adjust_sl"
    | "adjust_tp"
    | "breakeven"
    | "trailing_update"
    | "partial_close"
    | "scale_in"
    | "close"
    | "re_evaluate"
    | "news_protection"
  detail: string
  previousValue?: number
  newValue?: number
  timestamp: string
}

/** Scanner status for the AI Trader */
export interface AiTraderScanStatus {
  scanning: boolean
  enabled: boolean
  lastScanAt: string | null
  nextScanAt: string | null
  candidateCount: number
  activePairCount: number
  openAiTradeCount: number
  todayBudgetUsed: number
  monthlyBudgetUsed: number
  error: string | null
}

/** Scan progress phase for real-time updates */
export type AiTraderScanPhase =
  | "starting"
  | "checking_config"
  | "checking_market"
  | "checking_budget"
  | "scanning_pairs"
  | "analyzing_candidates"
  | "complete"
  | "skipped"
  | "error"

/** Real-time scan progress broadcast */
export interface AiTraderScanProgressData {
  phase: AiTraderScanPhase
  message: string
  pairsTotal: number
  pairsScanned: number
  candidatesFound: number
  candidatesAnalyzed: number
  candidatesTotal: number
  startedAt: string
  elapsedMs: number
}

/** A single entry in the scan activity log */
export interface AiTraderScanLogEntry {
  id: string
  timestamp: string
  type:
    | "scan_start"
    | "scan_skip"
    | "scan_complete"
    | "scan_error"
    | "pair_scanned"
    | "candidate_found"
    | "tier2_pass"
    | "tier2_fail"
    | "tier3_pass"
    | "tier3_fail"
    | "trade_placed"
    | "trade_rejected"
    | "gate_blocked"
  message: string
  detail?: string
  /** Structured metadata for rich UI display */
  metadata?: {
    instrument?: string
    direction?: "long" | "short"
    profile?: string
    confidence?: number
    entryPrice?: number
    stopLoss?: number
    takeProfit?: number
    riskRewardRatio?: number
    signalCount?: number
    pairsScanned?: number
    candidatesFound?: number
    candidatesAnalyzed?: number
    /** Pipeline funnel stats (scan_complete only) */
    tier2Passed?: number
    tier3Passed?: number
    tradesPlaced?: number
    gateBlocked?: number
    elapsedMs?: number
    reason?: string
    tier?: 1 | 2 | 3
    /** Primary technique that triggered the signal */
    primaryTechnique?: string
    /** Confluence techniques that contributed to the signal */
    techniques?: string[]
    /** Human-readable reasons from technical analysis */
    reasons?: string[]
    /** Error message when Tier 2/3 processing fails */
    error?: string
  }
}

/** Strategy performance stats for a profile/pair/session combination */
export interface AiTraderStrategyPerformanceData {
  profile: AiTraderProfile
  instrument: string | null // null = all instruments
  session: AiTraderSession | null // null = all sessions
  technique: AiTraderTechnique | null
  totalTrades: number
  wins: number
  losses: number
  breakevens: number
  winRate: number
  totalPL: number
  avgRR: number
  profitFactor: number
  expectancy: number
  maxDrawdown: number
  periodStart: string
  periodEnd: string
}

/** Cached external market data entry */
export interface AiTraderMarketDataEntry {
  dataType: AiTraderMarketDataType
  dataKey: string
  data: unknown
  fetchedAt: string
  expiresAt: string
}

/** Economic calendar event */
export interface EconomicCalendarEvent {
  title: string
  country: string
  currency: string
  impact: "high" | "medium" | "low"
  actual: string | null
  forecast: string | null
  previous: string | null
  timestamp: string
}

/** COT positioning data */
export interface CotPositioningData {
  currency: string
  netLong: number
  weeklyChange: number
  percentLong: number
  reportDate: string
}

/** News sentiment summary for a currency or pair */
export interface NewsSentimentData {
  subject: string // Currency or pair
  sentiment: "bullish" | "bearish" | "neutral"
  score: number // -100 to 100
  articleCount: number
  topHeadlines: string[]
  fetchedAt: string
}

// ─── AI Trader WebSocket Messages ─────────────────────────────────────────────

/** Broadcast when the AI Trader detects a new trading opportunity. */
export interface AiTraderOpportunityFoundMessage extends DaemonMessage<AiTraderOpportunityData> {
  type: "ai_trader_opportunity_found"
}

/** Broadcast when an AI Trader opportunity's status, scores, or management data changes. */
export interface AiTraderOpportunityUpdatedMessage extends DaemonMessage<AiTraderOpportunityData> {
  type: "ai_trader_opportunity_updated"
}

/** Broadcast when an AI Trader opportunity is removed (expired, rejected). */
export interface AiTraderOpportunityRemovedMessage extends DaemonMessage<{
  id: string
  reason: string
}> {
  type: "ai_trader_opportunity_removed"
}

/** Broadcast with updated AI Trader scanner status after each scan cycle. */
export interface AiTraderScanStatusMessage extends DaemonMessage<AiTraderScanStatus> {
  type: "ai_trader_scan_status"
}

/** Real-time scan progress updates during an AI Trader scan (per-pair, per-phase). */
export interface AiTraderScanProgressMessage extends DaemonMessage<AiTraderScanProgressData> {
  type: "ai_trader_scan_progress"
}

/** Individual activity log entry from an AI Trader scan (for the scan log UI). */
export interface AiTraderScanLogEntryMessage extends DaemonMessage<AiTraderScanLogEntry> {
  type: "ai_trader_scan_log_entry"
}

/** Broadcast when the AI Trader places a trade on OANDA. */
export interface AiTraderTradePlacedMessage extends DaemonMessage<{
  opportunityId: string
  tradeId: string
  instrument: string
  direction: TradeDirection
  confidence: number
  entryPrice: number
}> {
  type: "ai_trader_trade_placed"
}

/** Broadcast when the AI Trader takes a management action on an open trade (SL move, partial close, etc.). */
export interface AiTraderTradeManagedMessage extends DaemonMessage<{
  opportunityId: string
  tradeId: string
  action: AiTraderManagementAction
}> {
  type: "ai_trader_trade_managed"
}

/** Broadcast when an AI Trader trade is closed (by SL, TP, management, or manual action). */
export interface AiTraderTradeClosedMessage extends DaemonMessage<{
  opportunityId: string
  tradeId: string
  instrument: string
  direction: TradeDirection
  outcome: TradeOutcome
  realizedPL: number
  confidence: number
}> {
  type: "ai_trader_trade_closed"
}

/** AI Trader settings API response */
export interface AiTraderConfigResponse {
  config: AiTraderConfigData
  scanStatus: AiTraderScanStatus
}

/** Default management config */
export const AI_TRADER_DEFAULT_MANAGEMENT: AiTraderManagementConfig = {
  breakevenEnabled: true,
  breakevenTriggerRR: 1.0,
  trailingStopEnabled: true,
  trailingStopAtrMultiplier: 2.0,
  partialCloseEnabled: true,
  partialClosePercent: 50,
  partialCloseTargetRR: 1.5,
  timeExitEnabled: true,
  timeExitHours: 24,
  newsProtectionEnabled: true,
  reEvaluationEnabled: true,
  scaleInEnabled: false,
}

/** Default enabled techniques */
export const AI_TRADER_DEFAULT_TECHNIQUES: Record<AiTraderTechnique, boolean> = {
  smc_structure: true,
  fair_value_gap: true,
  order_block: true,
  liquidity_sweep: true,
  supply_demand_zone: true,
  fibonacci_ote: true,
  rsi: true,
  macd: true,
  ema_alignment: true,
  bollinger_bands: true,
  williams_r: true,
  adx_regime: true,
  divergence: true,
  trend_detection: true,
}

/** Default enabled profiles */
export const AI_TRADER_DEFAULT_PROFILES: Record<AiTraderProfile, boolean> = {
  scalper: false,
  intraday: true,
  swing: true,
  news: false,
}

// ─── Economic Calendar ───────────────────────────────────────────────────────

/** Impact level for an economic event. */
export type EconomicEventImpact = "low" | "medium" | "high"

/** Persisted economic calendar event returned by the API. */
export interface EconomicEventData {
  id: string
  title: string
  currency: string
  impact: EconomicEventImpact
  actual: string | null
  forecast: string | null
  previous: string | null
  /** ISO timestamp of when the event occurs. */
  timestamp: string
}

// ─── Price Alerts ────────────────────────────────────────────────────────────

/** Direction condition for a standalone price alert. */
export type PriceAlertDirection = "above" | "below"

/** Lifecycle status of a standalone price alert. */
export type PriceAlertStatus = "active" | "triggered" | "expired" | "cancelled"

/** Serialized price alert data for the API/UI. */
export interface PriceAlertData {
  /** Alert ID. */
  id: string
  /** Instrument in OANDA format (e.g., "EUR_USD"). */
  instrument: string
  /** Whether target is above or below current price. */
  direction: PriceAlertDirection
  /** Price level that triggers the alert. */
  targetPrice: number
  /** Price when the alert was created. */
  currentPrice: number
  /** Optional user-provided note. */
  label: string | null
  /** Current lifecycle status. */
  status: PriceAlertStatus
  /** If true, re-arms after triggering. */
  repeating: boolean
  /** ISO timestamp when the alert was triggered; null if not yet triggered. */
  triggeredAt: string | null
  /** ISO timestamp when the alert expires; null for no expiry. */
  expiresAt: string | null
  /** ISO timestamp when the alert was created. */
  createdAt: string
}

/** WebSocket message broadcast when a price alert triggers. */
export interface PriceAlertTriggeredMessage extends DaemonMessage<PriceAlertData> {
  type: "price_alert_triggered"
}

// ─── Performance Analytics ──────────────────────────────────────────────────

/** Filters for analytics queries. All fields are optional. */
export interface AnalyticsFilters {
  dateFrom?: Date
  dateTo?: Date
  instrument?: string
  /** placedVia value from metadata (enriched source). */
  source?: string
  direction?: "long" | "short"
}

/** Overall performance summary across all filtered trades. */
export interface PerformanceSummary {
  totalTrades: number
  wins: number
  losses: number
  breakevens: number
  cancelled: number
  /** Win rate as a decimal (0-1). */
  winRate: number
  totalPL: number
  avgPL: number
  /** Sum of winning PL / abs(sum of losing PL). Capped at 999 when no losses. */
  profitFactor: number
  /** (winRate * avgWin) - (lossRate * avgLoss). */
  expectancy: number
  /** Average reward-to-risk ratio from SL/TP, where available. */
  avgRR: number
  avgHoldTimeMinutes: number
  largestWin: number
  largestLoss: number
  currentStreak: { type: "win" | "loss"; count: number }
  longestWinStreak: number
  longestLossStreak: number
}

/** Performance breakdown for a single instrument. */
export interface InstrumentPerformance {
  instrument: string
  trades: number
  wins: number
  losses: number
  winRate: number
  totalPL: number
  avgPL: number
  profitFactor: number
}

/** Performance breakdown for a trading session. */
export interface SessionPerformance {
  session: string
  trades: number
  wins: number
  winRate: number
  totalPL: number
  profitFactor: number
}

/** Performance breakdown for a day of the week. */
export interface DayOfWeekPerformance {
  /** 0=Sunday through 6=Saturday. */
  day: number
  dayName: string
  trades: number
  wins: number
  winRate: number
  totalPL: number
}

/** Performance breakdown for an hour of the day. */
export interface HourOfDayPerformance {
  /** 0-23 (UTC). */
  hour: number
  trades: number
  wins: number
  winRate: number
  totalPL: number
}

/** Performance breakdown by trade source (placedVia). */
export interface SourcePerformance {
  source: string
  sourceLabel: string
  trades: number
  wins: number
  winRate: number
  totalPL: number
  profitFactor: number
}

/** Period-level stats for a single trade source. */
export interface SourcePeriodStats {
  trades: number
  wins: number
  losses: number
  winRate: number
  totalPL: number
  avgPL: number
  avgWin: number
  avgLoss: number
  avgRR: number
  profitFactor: number
  expectancy: number
}

/** Full performance breakdown for a single trade source across time periods. */
export interface SourceDetailedPerformance {
  source: string
  sourceLabel: string
  /** Currently open trades for this source */
  openTrades: number
  /** Unrealized P&L for open trades */
  unrealizedPL: number
  /** Stats by period */
  today: SourcePeriodStats
  thisWeek: SourcePeriodStats
  thisMonth: SourcePeriodStats
  thisYear: SourcePeriodStats
  allTime: SourcePeriodStats
}

/** MFE/MAE data point for a single trade. */
export interface MfeMaeEntry {
  tradeId: string
  instrument: string
  outcome: string
  /** Maximum Favorable Excursion in pips, or null if not tracked. */
  mfePips: number | null
  /** Maximum Adverse Excursion in pips, or null if not tracked. */
  maePips: number | null
  realizedPL: number
  holdTimeMinutes: number
}

/** Single data point on the equity curve. */
export interface EquityCurvePoint {
  /** ISO date string (YYYY-MM-DD). */
  date: string
  cumulativePL: number
  tradeCount: number
  balance?: number
}

// ─── Source Priority ─────────────────────────────────────────────────────

/** Automation sources that participate in the priority system. */
export type PlacementSource = "trade_finder" | "tv_alerts" | "ai_trader" | "smart_flow"

/** How the priority order is determined. */
export type SourcePriorityMode = "manual" | "auto_select"

/** What happened when a source tried to place a trade. */
export type SourcePriorityAction =
  | "placed"
  | "blocked_open"
  | "blocked_pending"
  | "replaced_pending"
  | "blocked_manual"

/** Source priority configuration stored in DB. */
export interface SourcePriorityConfigData {
  enabled: boolean
  mode: SourcePriorityMode
  priorityOrder: PlacementSource[]
  autoSelectWindowDays: number
  autoSelectRecalcMinutes: number
}

/** Auto-select ranking entry (computed from win rate). */
export interface SourceAutoRank {
  source: PlacementSource
  winRate: number
  trades: number
  rank: number
}

/** A logged priority event (placement attempt result). */
export interface SourcePriorityLogEntry {
  id: string
  instrument: string
  requestingSource: string
  existingSource: string | null
  existingTradeId: string | null
  action: SourcePriorityAction
  reason: string
  createdAt: string
}

// ─── SmartFlow ──────────────────────────────────────────────────────────

/** Strategy preset identifiers. */
export type SmartFlowPreset =
  | "momentum_catch"
  | "steady_growth"
  | "swing_capture"
  | "trend_rider"
  | "recovery"
  | "custom"

/** SmartFlow trade lifecycle status. */
export type SmartFlowTradeStatus =
  | "waiting_entry"
  | "pending"
  | "open"
  | "managing"
  | "closing"
  | "closed"

/** Current management phase of a SmartFlow trade. */
export type SmartFlowPhase =
  | "entry"
  | "breakeven"
  | "trailing"
  | "partial"
  | "recovery"
  | "safety_net"
  | "target"

/** Which safety net was triggered. */
export type SmartFlowSafetyNet = "max_drawdown" | "max_hold" | "max_financing" | "margin_warning"

/** Position sizing modes. */
export type SmartFlowSizeMode = "risk_percent" | "fixed_units" | "fixed_lots" | "kelly"

/** Entry mode for a SmartFlow config. */
export type SmartFlowEntryMode = "market" | "smart_entry"

/** AI assist operating mode. */
export type SmartFlowAiMode = "off" | "suggest" | "auto_selective" | "full_auto"

/** Off-session behavior for management rules. */
export type SmartFlowOffSessionBehavior = "widen_thresholds" | "pause_management" | "normal"

/** Partial close rule (ATR-relative). */
export interface SmartFlowPartialCloseRule {
  /** Profit in ATR multiples to trigger. */
  atAtrMultiple: number
  /** Percentage of remaining position to close. */
  closePercent: number
}

/** Logged partial close execution. */
export interface SmartFlowPartialCloseEntry {
  at: string
  atrMultiple: number
  percent: number
  units: number
  pips: number
  pnl: number
}

/** A management action logged during trade lifecycle. */
export interface SmartFlowManagementEntry {
  at: string
  action: string
  source: "rule" | "ai" | "user"
  detail: string
  priceBid?: number
  priceAsk?: number
  confidence?: number
}

/** AI action toggles (which actions AI can auto-execute). */
export interface SmartFlowAiActionToggles {
  moveSL?: boolean
  moveTP?: boolean
  breakeven?: boolean
  partialClose?: boolean
  closeProfit?: boolean
  preemptiveSafetyClose?: boolean
  cancelEntry?: boolean
  adjustTrail?: boolean
}

/** Confidence thresholds per AI action (0-100). */
export interface SmartFlowAiConfidenceThresholds {
  moveSL?: number
  moveTP?: number
  breakeven?: number
  partialClose?: number
  closeProfit?: number
  preemptiveSafetyClose?: number
  cancelEntry?: number
  adjustTrail?: number
}

/** AI suggestion from monitoring cycle. */
export interface SmartFlowAiSuggestion {
  id: string
  at: string
  action: string
  params: Record<string, unknown>
  confidence: number
  rationale: string
  autoExecuted: boolean
  cost: number
  model: string
}

/** Smart entry condition for triggering delayed entries. */
export interface SmartFlowEntryCondition {
  type: "price_level" | "zone_proximity" | "rsi_threshold" | "momentum"
  value: Record<string, unknown>
}

/** Preset defaults definition (ATR-relative). */
export interface SmartFlowPresetDefaults {
  label: string
  description: string
  shortDescription: string
  slAtrMultiple: number
  tpAtrMultiple: number
  minRR: number
  breakevenEnabled: boolean
  breakevenAtrMultiple: number
  trailingEnabled: boolean
  trailingAtrMultiple: number
  trailingActivationAtr: number
  partialCloseRules: SmartFlowPartialCloseRule[]
  maxHoldHours: number
  recoveryEnabled: boolean
  sessionAwareManagement: boolean
  weekendCloseEnabled: boolean
  newsProtectionEnabled: boolean
  riskLevel: "low" | "medium" | "high" | "advanced"
}

/** Global SmartFlow settings. */
export interface SmartFlowSettingsData {
  enabled: boolean
  maxConcurrentTrades: number
  maxMarginPercent: number
  defaultPreset: SmartFlowPreset
  correlationWarningEnabled: boolean
  maxCorrelatedPairs: number
  aiBudgetDailyUsd: number
  aiBudgetMonthlyUsd: number
  aiDefaultModel: string
  defaultMaxDrawdownPercent: number
  defaultMaxHoldHours: number
  defaultMaxFinancingUsd: number
  spreadProtectionEnabled: boolean
  spreadProtectionMultiple: number
}

/** SmartFlow config data sent to UI. */
export interface SmartFlowConfigData {
  id: string
  instrument: string
  name: string
  direction: "long" | "short"
  preset: SmartFlowPreset
  isActive: boolean
  entryMode: SmartFlowEntryMode
  entryPrice: number | null
  entryConditions: SmartFlowEntryCondition[] | null
  entryExpireHours: number | null
  positionSizeMode: SmartFlowSizeMode
  positionSizeValue: number
  stopLossAtrMultiple: number | null
  takeProfitAtrMultiple: number | null
  stopLossPips: number | null
  takeProfitPips: number | null
  minRiskReward: number
  breakevenEnabled: boolean
  breakevenAtrMultiple: number
  breakevenBufferPips: number
  trailingEnabled: boolean
  trailingAtrMultiple: number
  trailingActivationAtr: number
  partialCloseRules: SmartFlowPartialCloseRule[]
  maxDrawdownPercent: number | null
  maxDrawdownPips: number | null
  maxHoldHours: number | null
  maxFinancingUsd: number | null
  sessionAwareManagement: boolean
  offSessionBehavior: SmartFlowOffSessionBehavior
  weekendCloseEnabled: boolean
  newsProtectionEnabled: boolean
  newsProtectionMinutes: number
  recoveryEnabled: boolean
  recoveryMaxLevels: number
  recoveryAtrInterval: number
  recoverySizeMultiplier: number
  recoveryTpAtrMultiple: number
  aiMode: SmartFlowAiMode
  aiMonitorIntervalHours: number
  aiModel: string | null
  aiActionToggles: SmartFlowAiActionToggles
  aiConfidenceThresholds: SmartFlowAiConfidenceThresholds
  aiMaxActionsPerDay: number
  aiCooldownAfterManualMins: number
  aiGracePeriodMins: number
  createdAt: string
  updatedAt: string
}

/** SmartFlow active trade data for UI display. */
export interface SmartFlowTradeData {
  id: string
  configId: string
  tradeId: string | null
  sourceTradeId: string | null
  status: SmartFlowTradeStatus
  entryPrice: number | null
  currentPhase: SmartFlowPhase
  breakevenTriggered: boolean
  trailingActivated: boolean
  partialCloseLog: SmartFlowPartialCloseEntry[]
  managementLog: SmartFlowManagementEntry[]
  recoveryLevel: number
  estimatedHours: number | null
  estimatedLow: number | null
  estimatedHigh: number | null
  safetyNetTriggered: SmartFlowSafetyNet | null
  financingAccumulated: number
  entrySpread: number | null
  aiActionsToday: number
  aiTotalCost: number
  aiSuggestions: SmartFlowAiSuggestion[]
  createdAt: string
  closedAt: string | null
  /** Merged from config for display convenience */
  instrument?: string
  direction?: string
  preset?: SmartFlowPreset
  configName?: string
}

/** Pair safety score for the ranking display. */
export interface PairSafetyScore {
  instrument: string
  totalScore: number
  spreadCostScore: number
  trendClarityScore: number
  sessionAlignmentScore: number
  historicalWinRateScore: number
  volatilityConsistencyScore: number
  currentSpread: number
  atrDaily: number
  trendDirection: "up" | "down" | "range" | null
  sessionStatus: "primary" | "overlap" | "off" | null
  winRate: number | null
  tradeCount: number
}

/** Time estimation result. */
export interface SmartFlowTimeEstimateResult {
  estimatedHours: number
  low: number
  high: number
  confidence: "low" | "medium" | "high"
  dataPoints: number
  method: "atr_bootstrap" | "historical"
}

/** Risk of ruin calculation result. */
export interface RiskOfRuinResult {
  riskPerTrade: number
  riskPerTradePercent: number
  maxConcurrent: number
  maxTotalRisk: number
  maxTotalRiskPercent: number
  consecutiveLossesTo50Pct: number
  probabilityOfRuin: number
  assessment: "safe" | "moderate" | "high_risk"
}

/** SmartFlow status overview (broadcast via WS). */
export interface SmartFlowStatusData {
  enabled: boolean
  activeConfigs: number
  openTrades: number
  waitingEntries: number
  todayPL: number
  todayTradeCount: number
  aiCostToday: number
}

/** SmartFlow trade management event (broadcast via WS). */
export interface SmartFlowTradeUpdateData {
  smartFlowTradeId: string
  tradeId: string | null
  instrument: string
  action: string
  phase: SmartFlowPhase
  detail: string
}

/** SmartFlow entry triggered event (broadcast via WS). */
export interface SmartFlowEntryTriggeredData {
  smartFlowTradeId: string
  configId: string
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  configName: string
}

/** SmartFlow safety alert event (broadcast via WS). */
export interface SmartFlowSafetyAlertData {
  smartFlowTradeId: string
  instrument: string
  safetyNet: SmartFlowSafetyNet
  detail: string
}

/** SmartFlow AI suggestion event (broadcast via WS). */
export interface SmartFlowAiSuggestionData {
  smartFlowTradeId: string
  instrument: string
  suggestion: SmartFlowAiSuggestion
}

/** Source priority event data (broadcast via WS). */
export interface SourcePriorityEventData {
  instrument: string
  requestingSource: string
  action: SourcePriorityAction
  reason: string
}

/** WS message: SmartFlow overall status update. */
export interface SmartFlowStatusMessage extends DaemonMessage<SmartFlowStatusData> {
  type: "smart_flow_status"
}

/** WS message: SmartFlow trade management update. */
export interface SmartFlowTradeUpdateMessage extends DaemonMessage<SmartFlowTradeUpdateData> {
  type: "smart_flow_trade_update"
}

/** WS message: SmartFlow entry triggered. */
export interface SmartFlowEntryTriggeredMessage extends DaemonMessage<SmartFlowEntryTriggeredData> {
  type: "smart_flow_entry_triggered"
}

/** WS message: SmartFlow safety net alert. */
export interface SmartFlowSafetyAlertMessage extends DaemonMessage<SmartFlowSafetyAlertData> {
  type: "smart_flow_safety_alert"
}

/** WS message: SmartFlow AI suggestion. */
export interface SmartFlowAiSuggestionMessage extends DaemonMessage<SmartFlowAiSuggestionData> {
  type: "smart_flow_ai_suggestion"
}

/** WS message: Source priority event. */
export interface SourcePriorityEventMessage extends DaemonMessage<SourcePriorityEventData> {
  type: "source_priority_event"
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export * from "./schemas"
