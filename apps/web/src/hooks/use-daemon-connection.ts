"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type {
  DaemonStatusSnapshot,
  OandaHealthData,
  MarketStatusData,
  NotificationData,
  AccountOverviewData,
  PositionsData,
  PositionsPriceData,
  TVAlertsStatusData,
  TVAlertSignal,
  AiAnalysisStartedMessage,
  AiAnalysisUpdateMessage,
  AiAnalysisCompletedMessage,
  AiAutoAnalysisDisabledMessage,
  ConditionTriggeredMessage,
  TradeFinderSetupData,
  TradeFinderScanStatus,
  TradeFinderAutoTradeEvent,
  TradeFinderCapUtilization,
  AiTraderOpportunityData,
  AiTraderScanStatus,
  AiTraderScanProgressData,
  AiTraderScanLogEntry,
  PriceAlertData,
  SmartFlowStatusData,
  SmartFlowTradeUpdateData,
  SmartFlowEntryTriggeredData,
  SmartFlowSafetyAlertData,
  SmartFlowAiSuggestionData,
  SourcePriorityEventData,
  AnyDaemonMessage,
} from "@fxflow/types"

/**
 * Auto-detect whether to connect directly to the daemon (local dev),
 * through the WebSocket proxy (remote/production), or to a cloud daemon.
 *
 * Cloud: NEXT_PUBLIC_CLOUD_DAEMON_URL is set → connect directly to remote daemon.
 * Local: browser is on localhost → connect to daemon on port 4100 directly.
 * Remote: browser is on a tunnel/domain → use /ws proxy path through same origin.
 */
function resolveDaemonUrls(): { wsUrl: string; restUrl: string } {
  if (typeof window === "undefined") return { wsUrl: "", restUrl: "" }

  // Cloud mode override — connect directly to remote daemon
  const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_DAEMON_URL
  if (cloudUrl) {
    return {
      wsUrl: cloudUrl.replace(/^http/, "ws"),
      restUrl: cloudUrl,
    }
  }

  const host = window.location.hostname
  const isLocal = host === "localhost" || host === "127.0.0.1"

  if (isLocal) {
    return {
      wsUrl: process.env.NEXT_PUBLIC_DAEMON_URL ?? "ws://localhost:4100",
      restUrl: process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100",
    }
  }

  // Remote: proxy through same origin
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`
  const restUrl = "" // REST calls go through Next.js API routes (same origin)
  return { wsUrl, restUrl }
}

const { wsUrl: DAEMON_WS_URL, restUrl: DAEMON_REST_URL } = resolveDaemonUrls()

const RECONNECT_BASE_DELAY = 2000
const RECONNECT_MAX_DELAY = 30000
const REST_POLL_INTERVAL = 5000

export interface DaemonConnectionState {
  /** Whether the WebSocket is currently connected to the daemon */
  isConnected: boolean
  /** Whether the daemon is reachable via REST (fallback when WS is unavailable) */
  isReachable: boolean
  /** Full status snapshot (null until first message received) */
  snapshot: DaemonStatusSnapshot | null
  /** Latest OANDA health data */
  oanda: OandaHealthData | null
  /** Latest market status data */
  market: MarketStatusData | null
  /** Most recent notification from daemon (for real-time updates) */
  lastNotification: NotificationData | null
  /** Latest account overview data */
  accountOverview: AccountOverviewData | null
  /** Live positions data (pending, open, closed today) */
  positions: PositionsData | null
  /** Imperatively overwrite the positions cache (use for optimistic updates before daemon resyncs) */
  setPositions: (data: PositionsData | null) => void
  /** Latest position price ticks */
  positionsPrices: PositionsPriceData | null
  /** Latest chart price ticks */
  chartPrices: PositionsPriceData | null
  /** TV Alerts module status */
  tvAlertsStatus: TVAlertsStatusData | null
  /** Imperatively overwrite the TV alerts status cache (use for optimistic updates before daemon resyncs) */
  setTVAlertsStatus: (data: TVAlertsStatusData | null) => void
  /** Most recent TV alert signal (for real-time updates) */
  lastTVSignal: TVAlertSignal | null
  /** Most recent AI analysis started event */
  lastAiAnalysisStarted: AiAnalysisStartedMessage["data"] | null
  /** Most recent AI analysis progress update */
  lastAiAnalysisUpdate: AiAnalysisUpdateMessage["data"] | null
  /** Most recent AI analysis completed (or failed) event */
  lastAiAnalysisCompleted: AiAnalysisCompletedMessage["data"] | null
  /** Most recent auto-analysis disabled event */
  lastAiAutoDisabled: AiAutoAnalysisDisabledMessage["data"] | null
  /** Most recent condition triggered event */
  lastConditionTriggered: ConditionTriggeredMessage["data"] | null
  /** Most recent Trade Finder setup found/updated */
  lastTradeFinderSetup: TradeFinderSetupData | null
  /** Most recent Trade Finder setup removed */
  lastTradeFinderRemoved: { setupId: string; instrument: string; reason: string } | null
  /** Latest Trade Finder scan status */
  tradeFinderScanStatus: TradeFinderScanStatus | null
  /** Most recent auto-trade event (placed/filled/skipped/cancelled) */
  lastAutoTradeEvent: TradeFinderAutoTradeEvent | null
  /** Latest auto-trade cap utilization snapshot */
  tradeFinderCapUtilization: TradeFinderCapUtilization | null
  /** Most recent AI Trader opportunity (found or updated) */
  lastAiTraderOpportunity: AiTraderOpportunityData | null
  /** Latest AI Trader scan status */
  lastAiTraderScanStatus: AiTraderScanStatus | null
  /** Latest AI Trader scan progress (real-time during scans) */
  lastAiTraderScanProgress: AiTraderScanProgressData | null
  /** Most recent scan log entry (for real-time activity feed) */
  lastAiTraderScanLogEntry: AiTraderScanLogEntry | null
  /** Most recent AI Trader event (trade placed/managed/closed, opportunity removed) */
  lastAiTraderEvent: Record<string, unknown> | null
  /** Most recent price alert triggered event */
  lastPriceAlertTriggered: PriceAlertData | null
  /** Latest SmartFlow status */
  lastSmartFlowStatus: SmartFlowStatusData | null
  /** Most recent SmartFlow trade update */
  lastSmartFlowTradeUpdate: SmartFlowTradeUpdateData | null
  /** Most recent SmartFlow entry triggered event */
  lastSmartFlowEntryTriggered: SmartFlowEntryTriggeredData | null
  /** Most recent SmartFlow safety alert */
  lastSmartFlowSafetyAlert: SmartFlowSafetyAlertData | null
  /** Most recent SmartFlow AI suggestion */
  lastSmartFlowAiSuggestion: SmartFlowAiSuggestionData | null
  /** Most recent source priority event */
  lastSourcePriorityEvent: SourcePriorityEventData | null
  /** Most recent AI error alert (quota, rate limit, overload, invalid key, etc.) */
  lastAiErrorAlert: Record<string, unknown> | null
  /** True after the first connection attempt has completed (success or failure) */
  connectionAttempted: boolean
}

export function useDaemonConnection(): DaemonConnectionState {
  const [isConnected, setIsConnected] = useState(false)
  const [snapshot, setSnapshot] = useState<DaemonStatusSnapshot | null>(null)
  const [oanda, setOanda] = useState<OandaHealthData | null>(null)
  const [market, setMarket] = useState<MarketStatusData | null>(null)
  const [lastNotification, setLastNotification] = useState<NotificationData | null>(null)
  const [accountOverview, setAccountOverview] = useState<AccountOverviewData | null>(null)
  const [positions, setPositions] = useState<PositionsData | null>(null)
  const [positionsPrices, setPositionsPrices] = useState<PositionsPriceData | null>(null)
  const [chartPrices, setChartPrices] = useState<PositionsPriceData | null>(null)
  const [tvAlertsStatus, setTVAlertsStatus] = useState<TVAlertsStatusData | null>(null)
  const [lastTVSignal, setLastTVSignal] = useState<TVAlertSignal | null>(null)
  const [lastAiAnalysisStarted, setLastAiAnalysisStarted] = useState<
    AiAnalysisStartedMessage["data"] | null
  >(null)
  const [lastAiAnalysisUpdate, setLastAiAnalysisUpdate] = useState<
    AiAnalysisUpdateMessage["data"] | null
  >(null)
  const [lastAiAnalysisCompleted, setLastAiAnalysisCompleted] = useState<
    AiAnalysisCompletedMessage["data"] | null
  >(null)
  const [lastAiAutoDisabled, setLastAiAutoDisabled] = useState<
    AiAutoAnalysisDisabledMessage["data"] | null
  >(null)
  const [lastConditionTriggered, setLastConditionTriggered] = useState<
    ConditionTriggeredMessage["data"] | null
  >(null)
  const [lastTradeFinderSetup, setLastTradeFinderSetup] = useState<TradeFinderSetupData | null>(
    null,
  )
  const [lastTradeFinderRemoved, setLastTradeFinderRemoved] = useState<{
    setupId: string
    instrument: string
    reason: string
  } | null>(null)
  const [tradeFinderScanStatus, setTradeFinderScanStatus] = useState<TradeFinderScanStatus | null>(
    null,
  )
  const [lastAutoTradeEvent, setLastAutoTradeEvent] = useState<TradeFinderAutoTradeEvent | null>(
    null,
  )
  const [tradeFinderCapUtilization, setTradeFinderCapUtilization] =
    useState<TradeFinderCapUtilization | null>(null)
  const [lastAiTraderOpportunity, setLastAiTraderOpportunity] =
    useState<AiTraderOpportunityData | null>(null)
  const [lastAiTraderScanStatus, setLastAiTraderScanStatus] = useState<AiTraderScanStatus | null>(
    null,
  )
  const [lastAiTraderScanProgress, setLastAiTraderScanProgress] =
    useState<AiTraderScanProgressData | null>(null)
  const [lastAiTraderScanLogEntry, setLastAiTraderScanLogEntry] =
    useState<AiTraderScanLogEntry | null>(null)
  const [lastAiTraderEvent, setLastAiTraderEvent] = useState<Record<string, unknown> | null>(null)
  const [lastPriceAlertTriggered, setLastPriceAlertTriggered] = useState<PriceAlertData | null>(
    null,
  )
  const [lastSmartFlowStatus, setLastSmartFlowStatus] = useState<SmartFlowStatusData | null>(null)
  const [lastSmartFlowTradeUpdate, setLastSmartFlowTradeUpdate] =
    useState<SmartFlowTradeUpdateData | null>(null)
  const [lastSmartFlowEntryTriggered, setLastSmartFlowEntryTriggered] =
    useState<SmartFlowEntryTriggeredData | null>(null)
  const [lastSmartFlowSafetyAlert, setLastSmartFlowSafetyAlert] =
    useState<SmartFlowSafetyAlertData | null>(null)
  const [lastSmartFlowAiSuggestion, setLastSmartFlowAiSuggestion] =
    useState<SmartFlowAiSuggestionData | null>(null)
  const [lastSourcePriorityEvent, setLastSourcePriorityEvent] =
    useState<SourcePriorityEventData | null>(null)
  const [lastAiErrorAlert, setLastAiErrorAlert] = useState<Record<string, unknown> | null>(null)
  const [connectionAttempted, setConnectionAttempted] = useState(false)
  const [isReachable, setIsReachable] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Use a ref for connect so scheduleReconnect always calls the latest version
  const connectRef = useRef<() => void>(() => {})

  connectRef.current = () => {
    if (!mountedRef.current || !DAEMON_WS_URL) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(DAEMON_WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setIsConnected(true)
        setConnectionAttempted(true)
        reconnectAttemptRef.current = 0
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const msg = JSON.parse(event.data as string) as AnyDaemonMessage
          switch (msg.type) {
            case "status_snapshot":
              setSnapshot(msg.data)
              setOanda(msg.data.oanda)
              setMarket(msg.data.market)
              setAccountOverview(msg.data.accountOverview ?? null)
              if (msg.data.positions) setPositions(msg.data.positions)
              if (msg.data.tvAlerts) setTVAlertsStatus(msg.data.tvAlerts)
              break
            case "oanda_update":
              setOanda(msg.data)
              break
            case "market_update":
              setMarket(msg.data)
              break
            case "account_overview_update":
              setAccountOverview(msg.data)
              break
            case "positions_update":
              setPositions(msg.data)
              break
            case "positions_price_update":
              setPositionsPrices(msg.data)
              break
            case "chart_price_update":
              setChartPrices(msg.data)
              break
            case "notification_created":
              setLastNotification(msg.data)
              break
            case "tv_alert_signal":
              setLastTVSignal(msg.data)
              break
            case "tv_alerts_status":
              setTVAlertsStatus(msg.data)
              break
            case "ai_analysis_started":
              setLastAiAnalysisStarted(msg.data)
              break
            case "ai_analysis_update":
              setLastAiAnalysisUpdate(msg.data)
              break
            case "ai_analysis_completed":
              setLastAiAnalysisCompleted(msg.data)
              break
            case "ai_auto_analysis_disabled":
              setLastAiAutoDisabled(msg.data)
              break
            case "condition_triggered":
              setLastConditionTriggered(msg.data)
              break
            case "trade_finder_setup_found":
            case "trade_finder_setup_updated":
              setLastTradeFinderSetup(msg.data)
              break
            case "trade_finder_setup_removed":
              setLastTradeFinderRemoved(msg.data)
              break
            case "trade_finder_scan_status":
              setTradeFinderScanStatus(msg.data)
              break
            case "trade_finder_auto_trade_placed": {
              const d = msg.data as {
                setupId: string
                instrument: string
                direction: string
                score: number
                sourceId: string
                entryPrice: number
              }
              setLastAutoTradeEvent({
                type: "placed",
                setupId: d.setupId,
                instrument: d.instrument,
                direction: d.direction as "long" | "short",
                score: d.score,
                sourceId: d.sourceId,
                entryPrice: d.entryPrice,
                timestamp: msg.timestamp,
              })
              break
            }
            case "trade_finder_auto_trade_filled": {
              const d = msg.data as {
                setupId: string
                instrument: string
                direction: string
                score: number
                sourceId: string
              }
              setLastAutoTradeEvent({
                type: "filled",
                setupId: d.setupId,
                instrument: d.instrument,
                direction: d.direction as "long" | "short",
                score: d.score,
                sourceId: d.sourceId,
                timestamp: msg.timestamp,
              })
              break
            }
            case "trade_finder_auto_trade_cancelled": {
              const d = msg.data as {
                setupId: string
                instrument: string
                reason: string
                sourceOrderId: string
              }
              setLastAutoTradeEvent({
                type: "cancelled",
                setupId: d.setupId,
                instrument: d.instrument,
                direction: "long",
                score: 0,
                reason: d.reason,
                sourceId: d.sourceOrderId,
                timestamp: msg.timestamp,
              })
              break
            }
            case "trade_finder_auto_trade_skipped": {
              const d = msg.data as {
                setupId: string
                instrument: string
                direction: string
                score: number
                reason: string
              }
              setLastAutoTradeEvent({
                type: "skipped",
                setupId: d.setupId,
                instrument: d.instrument,
                direction: (d.direction as "long" | "short") ?? "long",
                score: d.score,
                reason: d.reason,
                timestamp: msg.timestamp,
              })
              break
            }
            case "trade_finder_cap_utilization":
              setTradeFinderCapUtilization(msg.data as TradeFinderCapUtilization)
              break
            case "ai_trader_opportunity_found":
            case "ai_trader_opportunity_updated":
              setLastAiTraderOpportunity(msg.data)
              break
            case "ai_trader_scan_status":
              setLastAiTraderScanStatus(msg.data)
              break
            case "ai_trader_scan_progress":
              setLastAiTraderScanProgress(msg.data)
              break
            case "ai_trader_scan_log_entry":
              setLastAiTraderScanLogEntry(msg.data as AiTraderScanLogEntry)
              break
            case "ai_trader_trade_placed":
            case "ai_trader_trade_managed":
            case "ai_trader_trade_closed":
            case "ai_trader_opportunity_removed":
              setLastAiTraderEvent(msg.data as Record<string, unknown>)
              break
            case "price_alert_triggered":
              setLastPriceAlertTriggered(msg.data)
              break
            case "smart_flow_activity":
              window.dispatchEvent(new CustomEvent("smart-flow-activity", { detail: msg.data }))
              break
            case "smart_flow_status":
              setLastSmartFlowStatus(msg.data)
              window.dispatchEvent(new CustomEvent("smart-flow-status", { detail: msg.data }))
              break
            case "smart_flow_trade_update":
              setLastSmartFlowTradeUpdate(msg.data)
              window.dispatchEvent(new CustomEvent("smart-flow-trade-update", { detail: msg.data }))
              break
            case "smart_flow_entry_triggered":
              setLastSmartFlowEntryTriggered(msg.data)
              window.dispatchEvent(
                new CustomEvent("smart-flow-entry-triggered", { detail: msg.data }),
              )
              toast.success(
                `SmartFlow entry: ${msg.data.instrument} ${msg.data.direction} @ ${msg.data.entryPrice}`,
              )
              break
            case "smart_flow_safety_alert":
              setLastSmartFlowSafetyAlert(msg.data)
              toast.warning(`SmartFlow safety: ${msg.data.instrument} — ${msg.data.detail}`)
              break
            case "smart_flow_ai_suggestion":
              setLastSmartFlowAiSuggestion(msg.data)
              toast.info(`SmartFlow AI: ${msg.data.instrument} — ${msg.data.suggestion.action}`)
              break
            case "source_priority_event":
              setLastSourcePriorityEvent(msg.data)
              toast.info(`Source priority: ${msg.data.instrument} — ${msg.data.reason}`)
              break
            case "ai_error_alert": {
              const alertData = msg.data as {
                category: string
                message: string
                source: string
                retryable: boolean
              }
              setLastAiErrorAlert(alertData as Record<string, unknown>)
              window.dispatchEvent(new CustomEvent("ai-error-alert", { detail: alertData }))
              if (alertData.category === "quota_exceeded" || alertData.category === "invalid_key") {
                toast.error(alertData.message, { duration: 10_000 })
              } else {
                toast.warning(alertData.message, { duration: 5_000 })
              }
              break
            }
            case "error":
              console.warn("[daemon-ws] Error from daemon:", msg.data.message)
              break
          }
        } catch {
          console.warn("[daemon-ws] Failed to parse message")
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setIsConnected(false)
        setConnectionAttempted(true)
        wsRef.current = null
        scheduleReconnect()
      }

      ws.onerror = () => {
        // onclose will fire after this
      }
    } catch {
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (!mountedRef.current) return
    const delay =
      Math.min(
        RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
        RECONNECT_MAX_DELAY,
      ) +
      Math.random() * 1000 // jitter to prevent thundering herd
    reconnectAttemptRef.current++
    reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay)
  }

  // REST fetch helper — used for initial load and polling fallback
  const fetchStatusViaRest = useRef(() => {
    const restBase = DAEMON_REST_URL || "/api/daemon"

    fetch(`${restBase}/status`)
      .then((res) =>
        res.ok ? (res.json() as Promise<{ ok: boolean; data: DaemonStatusSnapshot }>) : null,
      )
      .then((json) => {
        if (json?.ok && json.data && mountedRef.current) {
          setIsReachable(true)
          setSnapshot(json.data)
          setOanda(json.data.oanda)
          setMarket(json.data.market)
          setAccountOverview(json.data.accountOverview ?? null)
          if (json.data.positions) setPositions(json.data.positions)
          if (json.data.tvAlerts) setTVAlertsStatus(json.data.tvAlerts)
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setIsReachable(false)
          setConnectionAttempted(true)
        }
      })

    fetch(`${restBase}/trade-finder/status`)
      .then((res) =>
        res.ok ? (res.json() as Promise<{ ok: boolean; data: TradeFinderScanStatus }>) : null,
      )
      .then((json) => {
        if (json?.ok && json.data && mountedRef.current) {
          setTradeFinderScanStatus(json.data)
        }
      })
      .catch(() => {})

    fetch(`${restBase}/ai-trader/status`)
      .then((res) =>
        res.ok ? (res.json() as Promise<{ ok: boolean; data: AiTraderScanStatus }>) : null,
      )
      .then((json) => {
        if (json?.ok && json.data && mountedRef.current) {
          setLastAiTraderScanStatus(json.data)
        }
      })
      .catch(() => {})
  })

  useEffect(() => {
    mountedRef.current = true

    // Initial REST fetch
    fetchStatusViaRest.current()

    // Establish WebSocket connection
    connectRef.current()

    // REST polling fallback: when WS proxy is unavailable (dev mode + remote),
    // poll via REST to keep the UI updated with daemon status
    const pollTimer = setInterval(() => {
      if (!mountedRef.current) return
      // Only poll when WS isn't connected — WS is more efficient
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        fetchStatusViaRest.current()
      }
    }, REST_POLL_INTERVAL)

    return () => {
      mountedRef.current = false
      clearInterval(pollTimer)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // Prevent reconnect on cleanup
        wsRef.current.close()
      }
    }
  }, [])

  return {
    isConnected,
    isReachable,
    connectionAttempted,
    snapshot,
    oanda,
    market,
    lastNotification,
    accountOverview,
    positions,
    setPositions,
    positionsPrices,
    chartPrices,
    tvAlertsStatus,
    setTVAlertsStatus,
    lastTVSignal,
    lastAiAnalysisStarted,
    lastAiAnalysisUpdate,
    lastAiAnalysisCompleted,
    lastAiAutoDisabled,
    lastConditionTriggered,
    lastTradeFinderSetup,
    lastTradeFinderRemoved,
    tradeFinderScanStatus,
    lastAutoTradeEvent,
    tradeFinderCapUtilization,
    lastAiTraderOpportunity,
    lastAiTraderScanStatus,
    lastAiTraderScanProgress,
    lastAiTraderScanLogEntry,
    lastAiTraderEvent,
    lastPriceAlertTriggered,
    lastSmartFlowStatus,
    lastSmartFlowTradeUpdate,
    lastSmartFlowEntryTriggered,
    lastSmartFlowSafetyAlert,
    lastSmartFlowAiSuggestion,
    lastSourcePriorityEvent,
    lastAiErrorAlert,
  }
}
