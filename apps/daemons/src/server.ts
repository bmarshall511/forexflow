import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { WebSocketServer, WebSocket } from "ws"
import type { StateManager } from "./state-manager.js"
import type { CredentialWatcher } from "./db/credential-watcher.js"
import type { OandaTradeSyncer } from "./oanda/trade-syncer.js"
import type { NotificationEmitter } from "./notification-emitter.js"
import type { CFWorkerClient } from "./tv-alerts/cf-worker-client.js"
import type { TVAlertsState } from "./tv-alerts/alerts-state.js"
import type { ConditionMonitor } from "./ai/condition-monitor.js"
import type {
  AnyDaemonMessage,
  AiClaudeModel,
  AiAnalysisDepth,
  AiAnalysisTriggeredBy,
  Timeframe,
} from "@fxflow/types"

// Late-bound references (set after creation in index.ts)
let _cfWorkerClient: CFWorkerClient | null = null
export function setCFWorkerClient(client: CFWorkerClient): void {
  _cfWorkerClient = client
}

let _conditionMonitor: ConditionMonitor | null = null
export function setConditionMonitor(monitor: ConditionMonitor): void {
  _conditionMonitor = monitor
}

let _tvAlertsState: TVAlertsState | null = null
export function setTVAlertsState(state: TVAlertsState): void {
  _tvAlertsState = state
}

import type { TradeFinderScanner } from "./trade-finder/scanner.js"
let _tradeFinderScanner: TradeFinderScanner | null = null
export function setTradeFinderScanner(scanner: TradeFinderScanner): void {
  _tradeFinderScanner = scanner
}

import type { DigestGenerator } from "./ai/digest-generator.js"
let _digestGenerator: DigestGenerator | null = null
export function setDigestGenerator(generator: DigestGenerator): void {
  _digestGenerator = generator
}

import type { AiTraderScanner } from "./ai-trader/scanner.js"
let _aiTraderScanner: AiTraderScanner | null = null
export function setAiTraderScanner(scanner: AiTraderScanner): void {
  _aiTraderScanner = scanner
}

import type { AlertMonitor } from "./alerts/alert-monitor.js"
let _alertMonitor: AlertMonitor | null = null
export function setAlertMonitor(monitor: AlertMonitor): void {
  _alertMonitor = monitor
}

import type { SourcePriorityManager } from "./source-priority-manager.js"
let _sourcePriorityManager: SourcePriorityManager | null = null
export function setSourcePriorityManager(manager: SourcePriorityManager): void {
  _sourcePriorityManager = manager
}

import { getActivityEvents, emitActivity, clearActivityEvents } from "./smart-flow/activity-feed.js"
import type { SmartFlowManager } from "./smart-flow/manager.js"
let _smartFlowManager: SmartFlowManager | null = null
export function setSmartFlowManager(manager: SmartFlowManager): void {
  _smartFlowManager = manager
}

interface ServerDeps {
  stateManager: StateManager
  credentialWatcher: CredentialWatcher
  tradeSyncer?: OandaTradeSyncer
  notificationEmitter?: NotificationEmitter
  allowedOrigins?: string[]
}

/** Read the full request body as a string. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks).toString()))
    req.on("error", reject)
  })
}

/** Send a JSON response. */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(data))
}

export async function startServer(port: number, deps: ServerDeps) {
  const { stateManager, credentialWatcher, tradeSyncer, allowedOrigins } = deps
  const connectedClients = new Set<WebSocket>()

  // HTTP server for REST endpoints
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS: restrict to allowed origins (defaults to localhost:3000)
    const origin = req.headers.origin ?? ""
    const isAllowed =
      !allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes(origin)
    res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin || "*" : "")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (isAllowed && origin) {
      res.setHeader("Vary", "Origin")
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === "GET" && req.url === "/status") {
      const snapshot = stateManager.getSnapshot()
      sendJson(res, 200, { ok: true, data: snapshot })
      return
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, uptime: process.uptime() })
      return
    }

    // Readiness probe for container orchestrators (Railway, Fly.io, K8s).
    // Returns 200 only when the daemon is fully initialized and ready to serve.
    if (req.method === "GET" && req.url === "/health/ready") {
      const snapshot = stateManager.getSnapshot()
      const isReady = snapshot.uptimeSeconds > 0
      sendJson(res, isReady ? 200 : 503, { ok: isReady, uptime: process.uptime() })
      return
    }
    if (req.method === "GET" && req.url === "/health/detailed") {
      const mem = process.memoryUsage()
      const snapshot = stateManager.getSnapshot()
      sendJson(res, 200, {
        ok: true,
        data: {
          uptimeSeconds: snapshot.uptimeSeconds,
          startedAt: snapshot.startedAt,
          memory: {
            rss: mem.rss,
            heapUsed: mem.heapUsed,
            heapTotal: mem.heapTotal,
            external: mem.external,
          },
          wsClients: connectedClients.size,
          oanda: snapshot.oanda,
          market: snapshot.market,
          tradingMode: snapshot.tradingMode,
          tvAlerts: snapshot.tvAlerts ?? null,
          tradeFinder: _tradeFinderScanner
            ? { enabled: true, scanStatus: _tradeFinderScanner.getScanStatus() }
            : { enabled: false, scanStatus: null },
          aiTrader: _aiTraderScanner ? { enabled: true } : { enabled: false },
        },
      })
      return
    }

    if (req.method === "POST" && req.url === "/refresh-credentials") {
      credentialWatcher
        .checkNow()
        .then(() => {
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] refresh-credentials error:", err)
          sendJson(res, 500, { ok: false, error: "Internal error" })
        })
      return
    }

    // ─── Trade Action Endpoints ──────────────────────────────────────────

    if (req.method === "POST" && req.url === "/actions/refresh-positions") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      tradeSyncer
        .refreshPositions()
        .then(() => {
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] refresh-positions error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/cancel-order") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { sourceOrderId, reason } = JSON.parse(body)
          if (!sourceOrderId) {
            sendJson(res, 400, { ok: false, error: "sourceOrderId is required" })
            return
          }
          await tradeSyncer.cancelOrder(sourceOrderId, reason)
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] cancel-order error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/cancel-all-orders") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { sourceOrderIds, reason } = JSON.parse(body)
          const result = await tradeSyncer.cancelAllOrders(sourceOrderIds, reason)
          sendJson(res, 200, { ok: true, data: result })
        })
        .catch((err) => {
          console.error("[server] cancel-all-orders error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/close-all-trades") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { sourceTradeIds, reason } = JSON.parse(body)
          const result = await tradeSyncer.closeAllTrades(sourceTradeIds, reason)
          sendJson(res, 200, { ok: true, data: result })
        })
        .catch((err) => {
          console.error("[server] close-all-trades error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/close-trade") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { sourceTradeId, units, reason } = JSON.parse(body)
          if (!sourceTradeId) {
            sendJson(res, 400, { ok: false, error: "sourceTradeId is required" })
            return
          }
          await tradeSyncer.closeTrade(sourceTradeId, units, reason)
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] close-trade error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/modify-trade") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { sourceTradeId, stopLoss, takeProfit } = JSON.parse(body)
          if (!sourceTradeId) {
            sendJson(res, 400, { ok: false, error: "sourceTradeId is required" })
            return
          }
          const verified = await tradeSyncer.modifyTradeSLTP(sourceTradeId, stopLoss, takeProfit)
          sendJson(res, 200, { ok: true, data: verified })
        })
        .catch((err) => {
          console.error("[server] modify-trade error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/modify-pending-order") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { sourceOrderId, stopLoss, takeProfit, entryPrice, gtdTime } = JSON.parse(body)
          if (!sourceOrderId) {
            sendJson(res, 400, { ok: false, error: "sourceOrderId is required" })
            return
          }
          const verified = await tradeSyncer.modifyPendingOrderSLTP(
            sourceOrderId,
            stopLoss,
            takeProfit,
            entryPrice,
            gtdTime,
          )
          sendJson(res, 200, { ok: true, data: verified })
        })
        .catch((err) => {
          console.error("[server] modify-pending-order error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/place-order") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const request = JSON.parse(body)
          if (!request.instrument || !request.direction || !request.orderType || !request.units) {
            sendJson(res, 400, {
              ok: false,
              error: "instrument, direction, orderType, and units are required",
            })
            return
          }
          if (request.orderType === "LIMIT" && request.entryPrice === undefined) {
            sendJson(res, 400, { ok: false, error: "entryPrice is required for LIMIT orders" })
            return
          }
          if (request.units <= 0) {
            sendJson(res, 400, { ok: false, error: "units must be positive" })
            return
          }
          const data = await tradeSyncer.placeOrder(request)
          sendJson(res, 200, { ok: true, data })
        })
        .catch((err) => {
          console.error("[server] place-order error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // ─── TV Alerts Endpoints ──────────────────────────────────────────

    if (req.method === "POST" && req.url === "/actions/tv-alerts/kill-switch") {
      readBody(req)
        .then((body) => {
          const { enabled } = JSON.parse(body) as { enabled?: boolean }
          if (typeof enabled !== "boolean") {
            sendJson(res, 400, { ok: false, error: "enabled (boolean) is required" })
            return
          }
          // Update in-memory state (DB already updated by the web API route).
          // setEnabled triggers emit() → onChange listener → broadcast to all WS clients.
          if (_tvAlertsState) {
            _tvAlertsState.setEnabled(enabled)
          }
          sendJson(res, 200, { ok: true, enabled })
        })
        .catch((err) => {
          console.error("[server] tv-alerts kill-switch error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "GET" && req.url === "/actions/tv-alerts/config") {
      import("@fxflow/db")
        .then(async ({ getTVAlertsConfig }) => {
          const config = await getTVAlertsConfig()
          sendJson(res, 200, { ok: true, data: config })
        })
        .catch((err) => {
          console.error("[server] tv-alerts config error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/tv-alerts/reconnect-cf") {
      if (!_cfWorkerClient) {
        sendJson(res, 503, { ok: false, error: "TV Alerts module not available" })
        return
      }
      import("@fxflow/db")
        .then(async ({ getTVAlertsConfig }) => {
          const dbConfig = await getTVAlertsConfig()
          const url = dbConfig.cfWorkerUrl
          const secret = dbConfig.cfWorkerSecret
          if (url) {
            _cfWorkerClient!.reconnect(url, secret)
            console.log("[server] TV Alerts: reconnecting to CF Worker with new config")
          } else {
            _cfWorkerClient!.reconnect("", "")
            console.log("[server] TV Alerts: disconnecting CF Worker (URL cleared)")
          }
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] tv-alerts reconnect-cf error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/tv-alerts/clear-cooldown") {
      if (!_tvAlertsState) {
        sendJson(res, 503, { ok: false, error: "TV Alerts state not available" })
        return
      }
      readBody(req)
        .then((body) => {
          const { instrument } = JSON.parse(body) as { instrument?: string }
          if (!instrument) {
            sendJson(res, 400, { ok: false, error: "instrument is required" })
            return
          }
          _tvAlertsState!.clearCooldown(instrument)
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] tv-alerts clear-cooldown error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // Re-read signal count from DB and sync daemon in-memory state.
    // Called after clearing signal history so status broadcasts reflect the correct count.
    if (req.method === "POST" && req.url === "/actions/tv-alerts/reset-signal-history") {
      if (!_tvAlertsState) {
        sendJson(res, 503, { ok: false, error: "TV Alerts state not available" })
        return
      }
      import("@fxflow/db")
        .then(async ({ getTodaySignalCount }) => {
          const count = await getTodaySignalCount()
          _tvAlertsState!.setSignalCountToday(count)
          sendJson(res, 200, { ok: true, data: { signalCountToday: count } })
        })
        .catch((err) => {
          console.error("[server] tv-alerts reset-signal-history error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // ─── AI Analysis Endpoints ──────────────────────────────────────────

    if (req.method === "POST" && req.url?.startsWith("/actions/ai/analyze/")) {
      const tradeId = req.url.replace("/actions/ai/analyze/", "")
      if (!tradeId || !tradeSyncer) {
        sendJson(res, 400, { ok: false, error: "tradeId is required" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { model, depth, triggeredBy, tradeStatus } = JSON.parse(body) as {
            model: AiClaudeModel
            depth: AiAnalysisDepth
            triggeredBy?: AiAnalysisTriggeredBy
            tradeStatus: string
          }

          const { createAnalysis } = await import("@fxflow/db")
          const { executeAnalysis } = await import("./ai/analysis-executor.js")

          const analysis = await createAnalysis({
            tradeId,
            depth,
            model,
            tradeStatus,
            triggeredBy: triggeredBy ?? "user",
          })

          // Execute async in background — progress streamed via WebSocket
          void executeAnalysis({
            analysisId: analysis.id,
            tradeId,
            depth,
            model,
            tradeStatus,
            triggeredBy: triggeredBy ?? "user",
            stateManager,
            tradeSyncer,
            broadcast,
            conditionMonitor: _conditionMonitor,
          })

          sendJson(res, 200, { ok: true, data: { analysisId: analysis.id } })
        })
        .catch((err) => {
          console.error("[server] ai/analyze error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/actions/ai/cancel/")) {
      const analysisId = req.url.replace("/actions/ai/cancel/", "")
      if (!analysisId) {
        sendJson(res, 400, { ok: false, error: "analysisId is required" })
        return
      }
      void (async () => {
        try {
          const { cancelActiveAnalysis } = await import("./ai/analysis-executor.js")
          cancelActiveAnalysis(analysisId)
          const { cancelAnalysis } = await import("@fxflow/db")
          await cancelAnalysis(analysisId)
          sendJson(res, 200, { ok: true })
        } catch (err) {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        }
      })()
      return
    }

    if (req.method === "POST" && req.url === "/actions/ai/cancel-all-running") {
      void (async () => {
        try {
          const { cancelAllActiveAnalyses } = await import("./ai/analysis-executor.js")
          const aborted = cancelAllActiveAnalyses()
          // Also mark any DB rows still in running/pending as cancelled
          const { db } = await import("@fxflow/db")
          const { count } = await db.aiAnalysis.updateMany({
            where: { status: { in: ["running", "pending"] } },
            data: { status: "cancelled", errorMessage: "Cancelled by user (bulk clear)" },
          })
          sendJson(res, 200, { ok: true, data: { aborted, cancelled: count } })
        } catch (err) {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        }
      })()
      return
    }

    if (req.method === "POST" && req.url === "/actions/ai/cancel-all-conditions") {
      void (async () => {
        try {
          const { cancelAllActiveConditions } = await import("@fxflow/db")
          const cancelled = await cancelAllActiveConditions()
          if (_conditionMonitor) {
            _conditionMonitor.clearAll()
          }
          sendJson(res, 200, { ok: true, data: { cancelled } })
        } catch (err) {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        }
      })()
      return
    }
    if (req.method === "POST" && req.url === "/actions/ai/reload-condition") {
      if (!_conditionMonitor) {
        sendJson(res, 503, { ok: false, error: "Condition monitor not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { conditionId, action } = JSON.parse(body) as {
            conditionId: string
            action?: string
          }
          if (!conditionId) {
            sendJson(res, 400, { ok: false, error: "conditionId is required" })
            return
          }
          if (action === "remove") {
            _conditionMonitor!.removeCondition(conditionId)
          } else {
            await _conditionMonitor!.reloadCondition(conditionId)
          }
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // POST /actions/ai/generate-digest — trigger manual digest generation
    if (req.method === "POST" && req.url === "/actions/ai/generate-digest") {
      if (!_digestGenerator) {
        sendJson(res, 503, { ok: false, error: "Digest generator not available" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const { period, periodStart, periodEnd } = JSON.parse(body) as {
            period: "weekly" | "monthly"
            periodStart: string
            periodEnd: string
          }
          if (!period || !periodStart || !periodEnd) {
            sendJson(res, 400, {
              ok: false,
              error: "period, periodStart, and periodEnd are required",
            })
            return
          }
          // Trigger generation in background (don't block the response)
          void _digestGenerator!.generateDigest(period, new Date(periodStart), new Date(periodEnd))
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] ai/generate-digest error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // ─── Chart Subscriptions ────────────────────────────────────────────

    if (req.method === "POST" && req.url === "/chart-subscriptions") {
      readBody(req)
        .then((body) => {
          const { instruments } = JSON.parse(body) as { instruments?: string[] }
          stateManager.setChartInstruments(instruments ?? [])
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          console.error("[server] chart-subscriptions error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // ─── Trade Finder ──────────────────────────────────────────────────

    if (req.method === "GET" && req.url === "/trade-finder/status") {
      if (!_tradeFinderScanner) {
        sendJson(res, 503, { ok: false, error: "Trade Finder not initialized" })
        return
      }
      sendJson(res, 200, { ok: true, data: _tradeFinderScanner.getScanStatus() })
      return
    }

    if (req.method === "GET" && req.url === "/trade-finder/auto-trade-events") {
      if (!_tradeFinderScanner) {
        sendJson(res, 503, { ok: false, error: "Trade Finder not initialized" })
        return
      }
      sendJson(res, 200, { ok: true, data: _tradeFinderScanner.getAutoTradeEvents() })
      return
    }

    if (req.method === "GET" && req.url === "/trade-finder/caps") {
      if (!_tradeFinderScanner) {
        sendJson(res, 503, { ok: false, error: "Trade Finder not initialized" })
        return
      }
      _tradeFinderScanner
        .getCapUtilization()
        .then((caps) => sendJson(res, 200, { ok: true, data: caps }))
        .catch((err) => sendJson(res, 500, { ok: false, error: String(err) }))
      return
    }

    if (req.method === "POST" && req.url === "/actions/trade-finder/scan") {
      if (!_tradeFinderScanner) {
        sendJson(res, 503, { ok: false, error: "Trade Finder not initialized" })
        return
      }
      _tradeFinderScanner
        .triggerScan()
        .then(() => {
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // Cancel all pending auto-placed orders
    if (req.method === "POST" && req.url === "/actions/trade-finder/cancel-auto") {
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      import("@fxflow/db")
        .then(async ({ getPendingAutoPlacedSetups, updateSetupStatus: updateStatus }) => {
          const autoSetups = await getPendingAutoPlacedSetups()
          let cancelled = 0
          for (const setup of autoSetups) {
            if (setup.resultSourceId) {
              try {
                await tradeSyncer!.cancelOrder(
                  setup.resultSourceId,
                  "User cancelled all auto-trades",
                )
                await updateStatus(setup.id, "invalidated")
                cancelled++
              } catch (err) {
                console.warn(
                  `[server] Failed to cancel auto-placed order ${setup.resultSourceId}:`,
                  (err as Error).message,
                )
              }
            }
          }
          sendJson(res, 200, { ok: true, data: { cancelled, total: autoSetups.length } })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // Clear active setups
    if (req.method === "POST" && req.url === "/actions/trade-finder/clear-active") {
      import("@fxflow/db")
        .then(async ({ clearActiveSetups }) => {
          const count = await clearActiveSetups()
          sendJson(res, 200, { ok: true, data: { cleared: count } })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // Clear setup history
    if (req.method === "POST" && req.url === "/actions/trade-finder/clear-history") {
      import("@fxflow/db")
        .then(async ({ clearSetupHistory }) => {
          const count = await clearSetupHistory()
          sendJson(res, 200, { ok: true, data: { cleared: count } })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // Clear auto-trade activity log
    if (req.method === "POST" && req.url === "/actions/trade-finder/clear-activity") {
      if (!_tradeFinderScanner) {
        sendJson(res, 503, { ok: false, error: "Trade Finder not initialized" })
        return
      }
      _tradeFinderScanner.clearAutoTradeEvents()
      sendJson(res, 200, { ok: true, data: { cleared: true } })
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/actions/trade-finder/place/")) {
      const setupId = req.url.replace("/actions/trade-finder/place/", "")
      if (!tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "Trade syncer not available" })
        return
      }
      import("@fxflow/db")
        .then(async ({ getSetup, updateSetupStatus: updateStatus }) => {
          const setup = await getSetup(setupId)
          if (!setup) {
            sendJson(res, 404, { ok: false, error: "Setup not found" })
            return
          }
          const body = await readBody(req)
          const { orderType } = JSON.parse(body || "{}") as { orderType?: "MARKET" | "LIMIT" }

          // Derive the LTF from the setup's timeframe set for tagging the trade
          const { TIMEFRAME_SET_MAP } = await import("@fxflow/types")
          const tfMap = TIMEFRAME_SET_MAP[setup.timeframeSet]
          const ltfTimeframe = (tfMap?.ltf ?? null) as Timeframe | null

          const result = await tradeSyncer!.placeOrder({
            instrument: setup.instrument,
            direction: setup.direction,
            orderType: orderType ?? "LIMIT",
            units: setup.positionSize,
            entryPrice: orderType === "MARKET" ? undefined : setup.entryPrice,
            stopLoss: setup.stopLoss,
            takeProfit: setup.takeProfit,
            timeframe: ltfTimeframe,
            placedVia: "trade_finder",
          })

          await updateStatus(setupId, "placed", { resultSourceId: result.sourceId })
          sendJson(res, 200, { ok: true, data: result })
        })
        .catch((err) => {
          console.error("[server] trade-finder place error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // ─── AI Trader ────────────────────────────────────────────────────

    if (req.method === "GET" && req.url === "/ai-trader/status") {
      if (!_aiTraderScanner) {
        sendJson(res, 503, { ok: false, error: "AI Trader not initialized" })
        return
      }
      _aiTraderScanner
        .getFullScanStatus()
        .then((status) => {
          sendJson(res, 200, { ok: true, data: status })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/ai-trader/scan") {
      if (!_aiTraderScanner) {
        sendJson(res, 503, { ok: false, error: "AI Trader not initialized" })
        return
      }
      _aiTraderScanner
        .triggerScan()
        .then(() => {
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/actions/ai-trader/pause") {
      if (!_aiTraderScanner) {
        sendJson(res, 503, { ok: false, error: "AI Trader not initialized" })
        return
      }
      _aiTraderScanner.pause()
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === "POST" && req.url === "/actions/ai-trader/resume") {
      if (!_aiTraderScanner) {
        sendJson(res, 503, { ok: false, error: "AI Trader not initialized" })
        return
      }
      _aiTraderScanner.resume()
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === "GET" && req.url === "/ai-trader/scan-log") {
      if (!_aiTraderScanner) {
        sendJson(res, 503, { ok: false, error: "AI Trader not initialized" })
        return
      }
      sendJson(res, 200, { ok: true, data: _aiTraderScanner.getScanLog() })
      return
    }

    if (req.method === "GET" && req.url === "/ai-trader/scan-progress") {
      if (!_aiTraderScanner) {
        sendJson(res, 503, { ok: false, error: "AI Trader not initialized" })
        return
      }
      sendJson(res, 200, { ok: true, data: _aiTraderScanner.getScanProgress() })
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/actions/ai-trader/approve/")) {
      const opportunityId = req.url.replace("/actions/ai-trader/approve/", "")
      if (!_aiTraderScanner || !tradeSyncer) {
        sendJson(res, 503, { ok: false, error: "AI Trader not available" })
        return
      }
      import("@fxflow/db")
        .then(async ({ getOpportunity, updateOpportunityStatus }) => {
          const opp = await getOpportunity(opportunityId)
          if (!opp) {
            sendJson(res, 404, { ok: false, error: "Opportunity not found" })
            return
          }
          if (opp.status !== "suggested") {
            sendJson(res, 400, {
              ok: false,
              error: `Cannot approve opportunity in status "${opp.status}"`,
            })
            return
          }
          await updateOpportunityStatus(opportunityId, "approved")
          // Trigger execution (runs async)
          // The scanner's executeOpportunity is private, so we place the order directly
          const result = await tradeSyncer!.placeOrder({
            instrument: opp.instrument,
            direction: opp.direction,
            orderType: "LIMIT",
            units: opp.positionSize,
            entryPrice: opp.entryPrice,
            stopLoss: opp.stopLoss,
            takeProfit: opp.takeProfit,
            placedVia: "ai_trader_manual",
            notes: `AI Trade (manual approve) | ${opp.profile} | Confidence: ${opp.confidence}%`,
          })
          await updateOpportunityStatus(opportunityId, "placed", {
            resultSourceId: result.sourceId,
            placedAt: new Date(),
          })
          sendJson(res, 200, { ok: true, data: result })
        })
        .catch((err) => {
          console.error("[server] ai-trader approve error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/actions/ai-trader/reject/")) {
      const opportunityId = req.url.replace("/actions/ai-trader/reject/", "")
      import("@fxflow/db")
        .then(async ({ updateOpportunityStatus }) => {
          await updateOpportunityStatus(opportunityId, "rejected")
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    // ─── Price Alert Endpoints ───────────────────────────────────────────

    if (req.method === "POST" && req.url === "/actions/alerts/reload") {
      if (!_alertMonitor) {
        sendJson(res, 503, { ok: false, error: "Alert monitor not available" })
        return
      }
      void _alertMonitor.reload().then(() => {
        sendJson(res, 200, { ok: true })
      })
      return
    }

    // ─── Source Priority Endpoints ──────────────────────────────────────

    if (req.method === "GET" && req.url === "/source-priority/config") {
      if (!_sourcePriorityManager) {
        sendJson(res, 503, { ok: false, error: "Source Priority Manager not initialized" })
        return
      }
      sendJson(res, 200, { ok: true, data: _sourcePriorityManager.getConfig() })
      return
    }

    if (req.method === "POST" && req.url === "/source-priority/config") {
      if (!_sourcePriorityManager) {
        sendJson(res, 503, { ok: false, error: "Source Priority Manager not initialized" })
        return
      }
      readBody(req)
        .then(async (body) => {
          const updates = JSON.parse(body)
          const { updateSourcePriorityConfig } = await import("@fxflow/db")
          await updateSourcePriorityConfig(updates)
          const config = await _sourcePriorityManager!.loadConfig()
          sendJson(res, 200, { ok: true, data: config })
        })
        .catch((err) => {
          console.error("[server] source-priority config update error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "GET" && req.url === "/source-priority/logs") {
      if (!_sourcePriorityManager) {
        sendJson(res, 503, { ok: false, error: "Source Priority Manager not initialized" })
        return
      }
      _sourcePriorityManager
        .getRecentLogs()
        .then((logs) => sendJson(res, 200, { ok: true, data: logs }))
        .catch((err) => sendJson(res, 500, { ok: false, error: (err as Error).message }))
      return
    }

    if (req.method === "GET" && req.url === "/source-priority/auto-ranks") {
      if (!_sourcePriorityManager) {
        sendJson(res, 503, { ok: false, error: "Source Priority Manager not initialized" })
        return
      }
      sendJson(res, 200, { ok: true, data: _sourcePriorityManager.getAutoSelectRanks() })
      return
    }

    // ─── SmartFlow Endpoints ────────────────────────────────────────────

    if (req.method === "GET" && req.url === "/smart-flow/status") {
      if (!_smartFlowManager) {
        sendJson(res, 503, { ok: false, error: "SmartFlow not initialized" })
        return
      }
      _smartFlowManager
        .getStatus()
        .then((status) => sendJson(res, 200, { ok: true, data: status }))
        .catch((err) => sendJson(res, 500, { ok: false, error: (err as Error).message }))
      return
    }

    if (req.method === "GET" && req.url === "/smart-flow/configs") {
      import("@fxflow/db")
        .then(async ({ getSmartFlowConfigs }) => {
          const configs = await getSmartFlowConfigs()
          sendJson(res, 200, { ok: true, data: configs })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url === "/smart-flow/configs") {
      readBody(req)
        .then(async (body) => {
          const input = JSON.parse(body)
          const { createSmartFlowConfig } = await import("@fxflow/db")
          const config = await createSmartFlowConfig(input)
          sendJson(res, 200, { ok: true, data: config })
        })
        .catch((err) => {
          console.error("[server] smart-flow create config error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "GET" && req.url === "/smart-flow/trades") {
      import("@fxflow/db")
        .then(async ({ getActiveSmartFlowTrades }) => {
          const trades = await getActiveSmartFlowTrades()
          sendJson(res, 200, { ok: true, data: trades })
        })
        .catch((err) => {
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/smart-flow/place/")) {
      const configId = req.url.replace("/smart-flow/place/", "")
      if (!_smartFlowManager) {
        sendJson(res, 503, { ok: false, error: "SmartFlow not initialized" })
        return
      }
      _smartFlowManager
        .placeMarketEntry(configId)
        .then((result) => {
          if (result.success) {
            sendJson(res, 200, { ok: true, data: result.trade })
          } else {
            sendJson(res, 400, { ok: false, error: result.error })
          }
        })
        .catch((err) => {
          console.error("[server] smart-flow place error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/smart-flow/smart-entry/")) {
      const configId = req.url.replace("/smart-flow/smart-entry/", "")
      if (!_smartFlowManager) {
        sendJson(res, 503, { ok: false, error: "SmartFlow not initialized" })
        return
      }
      _smartFlowManager
        .createSmartEntry(configId)
        .then((result) => {
          if (result.success) {
            sendJson(res, 200, { ok: true, data: result.trade })
          } else {
            sendJson(res, 400, { ok: false, error: result.error })
          }
        })
        .catch((err) => {
          console.error("[server] smart-flow smart-entry error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "POST" && req.url?.startsWith("/smart-flow/cancel/")) {
      const id = req.url.replace("/smart-flow/cancel/", "")
      if (!_smartFlowManager) {
        sendJson(res, 503, { ok: false, error: "SmartFlow not initialized" })
        return
      }
      _smartFlowManager
        .cancelSmartFlowTrade(id)
        .then((result) => {
          if (result.success) {
            sendJson(res, 200, { ok: true })
          } else {
            sendJson(res, 400, { ok: false, error: result.error })
          }
        })
        .catch((err) => {
          console.error("[server] smart-flow cancel error:", err)
          sendJson(res, 500, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "GET" && req.url === "/smart-flow/activity") {
      sendJson(res, 200, { ok: true, events: getActivityEvents() })
      return
    }

    if (req.method === "DELETE" && req.url === "/smart-flow/activity") {
      clearActivityEvents()
        .then(() => sendJson(res, 200, { ok: true }))
        .catch((err) => sendJson(res, 500, { ok: false, error: (err as Error).message }))
      return
    }

    if (req.method === "POST" && req.url === "/smart-flow/log-activity") {
      readBody(req)
        .then((raw) => {
          const { type, message, instrument, detail, severity, configId, tradeId } = JSON.parse(
            raw,
          ) as {
            type: string
            message: string
            instrument?: string
            detail?: string
            severity?: "info" | "success" | "warning" | "error"
            configId?: string
            tradeId?: string
          }
          emitActivity(type as Parameters<typeof emitActivity>[0], message, {
            instrument,
            detail,
            severity,
            configId,
            tradeId,
          })
          sendJson(res, 200, { ok: true })
        })
        .catch((err) => {
          sendJson(res, 400, { ok: false, error: (err as Error).message })
        })
      return
    }

    if (req.method === "GET" && req.url === "/smart-flow/health") {
      if (!_smartFlowManager) {
        sendJson(res, 503, { ok: false, error: "SmartFlow not initialized" })
        return
      }
      try {
        const health = _smartFlowManager.getHealthData()
        sendJson(res, 200, { ok: true, health })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: (err as Error).message })
      }
      return
    }

    if (req.method === "GET" && req.url === "/smart-flow/config-runtime") {
      if (!_smartFlowManager) {
        sendJson(res, 503, { ok: false, error: "SmartFlow not initialized" })
        return
      }
      try {
        const statuses = _smartFlowManager.getConfigRuntimeStatuses()
        sendJson(res, 200, { ok: true, statuses })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: (err as Error).message })
      }
      return
    }

    sendJson(res, 404, { ok: false, error: "Not found" })
  })

  // WebSocket server (upgrade from same HTTP server)
  const wss = new WebSocketServer({ server: httpServer })

  wss.on("connection", (ws: WebSocket) => {
    connectedClients.add(ws)
    console.log(`[ws] Client connected (${connectedClients.size} total)`)

    // Send full snapshot immediately on connect
    const snapshot = stateManager.getSnapshot()
    ws.send(
      JSON.stringify({
        type: "status_snapshot",
        timestamp: new Date().toISOString(),
        data: snapshot,
      }),
    )

    // Send current positions if available
    const positions = stateManager.getPositions()
    if (positions) {
      ws.send(
        JSON.stringify({
          type: "positions_update",
          timestamp: new Date().toISOString(),
          data: positions,
        }),
      )
    }

    // Send full TV alerts status so dashboard has signal count, P&L, etc.
    // The snapshot.tvAlerts may be null if daemon is still initializing.
    const tvAlertsFullStatus = _tvAlertsState?.getStatus()
    if (tvAlertsFullStatus) {
      ws.send(
        JSON.stringify({
          type: "tv_alerts_status",
          timestamp: new Date().toISOString(),
          data: tvAlertsFullStatus,
        }),
      )
    }

    // Send SmartFlow status so dashboard has config state immediately
    if (_smartFlowManager) {
      _smartFlowManager
        .getStatus()
        .then((status) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "smart_flow_status",
                timestamp: new Date().toISOString(),
                data: status,
              }),
            )
          }
        })
        .catch(() => {
          /* non-critical */
        })
    }

    ws.on("close", () => {
      connectedClients.delete(ws)
      console.log(`[ws] Client disconnected (${connectedClients.size} total)`)
    })

    ws.on("error", (err) => {
      console.error("[ws] Client error:", err.message)
      connectedClients.delete(ws)
    })
  })

  // Start listening
  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => resolve())
  })

  // Broadcast to all connected clients
  function broadcast(message: AnyDaemonMessage): void {
    const json = JSON.stringify(message)
    for (const client of connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json)
      }
    }
  }

  return { httpServer, wss, broadcast }
}
