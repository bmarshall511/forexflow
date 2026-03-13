import dotenv from "dotenv"
import { resolve } from "path"

// Load .env.local first (preferred), then .env as fallback.
// dotenv won't override vars already set, so .env.local takes precedence.
dotenv.config({ path: resolve(process.cwd(), ".env.local") })
dotenv.config({ path: resolve(process.cwd(), ".env") })
import { startServer, setCFWorkerClient, setTVAlertsState, setConditionMonitor, setTradeFinderScanner, setDigestGenerator } from "./server.js"
import { StateManager } from "./state-manager.js"
import { CredentialWatcher } from "./db/credential-watcher.js"
import { OandaStreamClient } from "./oanda/stream-client.js"
import { OandaHealthChecker } from "./oanda/health-checker.js"
import { AccountDataCollector } from "./oanda/account-data-collector.js"
import { TransactionStreamClient } from "./oanda/transaction-stream-client.js"
import { OandaTradeSyncer } from "./oanda/trade-syncer.js"
import { PositionManager } from "./positions/position-manager.js"
import { PositionPriceTracker } from "./positions/position-price-tracker.js"
import { ChartPriceTracker } from "./charts/chart-price-tracker.js"
import { MarketAnalyzer } from "./market/market-analyzer.js"
import { NotificationEmitter } from "./notification-emitter.js"
import { CFWorkerClient } from "./tv-alerts/cf-worker-client.js"
import { SignalProcessor } from "./tv-alerts/signal-processor.js"
import { TVAlertsState } from "./tv-alerts/alerts-state.js"
import { ConditionMonitor } from "./ai/condition-monitor.js"
import { AutoAnalyzer } from "./ai/auto-analyzer.js"
import { DigestGenerator } from "./ai/digest-generator.js"
import { TradeFinderScanner } from "./trade-finder/scanner.js"
import { getConfig } from "./config.js"
import type { AnyDaemonMessage } from "@fxflow/types"

async function main() {
  const config = getConfig()
  console.log(`[daemon] Starting on port ${config.port}...`)

  // 1. Central state manager
  const stateManager = new StateManager()

  // 2. Sub-systems
  const credentialWatcher = new CredentialWatcher(stateManager, config.dbPollIntervalMs)
  const marketAnalyzer = new MarketAnalyzer(stateManager)
  const streamClient = new OandaStreamClient(
    stateManager,
    marketAnalyzer,
    config.streamReconnectDelayMs,
    config.streamReconnectMaxMs,
  )
  const healthChecker = new OandaHealthChecker(stateManager, config.healthCheckIntervalMs)

  // 3. Account data collector (tiered P&L polling)
  const accountDataCollector = new AccountDataCollector(stateManager, healthChecker, {
    todayPnlIntervalMs: config.todayPnlIntervalMs,
    shortPnlIntervalMs: config.shortPnlIntervalMs,
    longPnlIntervalMs: config.longPnlIntervalMs,
  })

  // 4. Transaction stream (instant ORDER_FILL detection)
  const transactionStreamClient = new TransactionStreamClient(
    stateManager,
    accountDataCollector,
    config.streamReconnectDelayMs,
    config.streamReconnectMaxMs,
  )

  // 5. Position tracking system
  const positionManager = new PositionManager()
  const tradeSyncer = new OandaTradeSyncer(stateManager, positionManager, {
    reconcileIntervalMs: config.tradeReconcileIntervalMs,
    backfillDays: config.tradeBackfillDays,
  })

  // Wire TransactionStreamClient → TradeSyncer for real-time events
  transactionStreamClient.setTradeSyncer(tradeSyncer)

  // 6. Start the HTTP+WS server (pass tradeSyncer for action endpoints)
  const { broadcast } = await startServer(config.port, {
    stateManager,
    credentialWatcher,
    tradeSyncer,
  })

  // 7. Wire state changes to broadcast
  stateManager.onStatusChange(() => {
    const msg: AnyDaemonMessage = {
      type: "status_snapshot",
      timestamp: new Date().toISOString(),
      data: stateManager.getSnapshot(),
    }
    broadcast(msg)
  })

  // 8. Wire account overview changes to broadcast (separate from status_snapshot)
  stateManager.onAccountOverviewChange((data) => {
    const msg: AnyDaemonMessage = {
      type: "account_overview_update",
      timestamp: new Date().toISOString(),
      data,
    }
    broadcast(msg)
  })

  // 9. Wire positions changes to state + broadcast
  positionManager.onPositionsChange((data) => {
    const summary = positionManager.getSummary()
    stateManager.updatePositions(data, summary)
    broadcast({
      type: "positions_update",
      timestamp: new Date().toISOString(),
      data,
    })
  })

  // 10. Position price tracker (dynamic pricing stream for active instruments)
  const positionPriceTracker = new PositionPriceTracker(
    stateManager,
    positionManager,
    broadcast,
    config.priceThrottleMs,
  )

  // 10b. Chart price tracker (pricing stream for chart page instruments)
  const chartPriceTracker = new ChartPriceTracker(stateManager, broadcast, config.priceThrottleMs)

  // 11. Notification emitter (OANDA state transitions + trade opens/closes → persisted alerts)
  const notificationEmitter = new NotificationEmitter(stateManager, broadcast, positionManager)
  notificationEmitter.start()

  // Wire trade action notifications (cancel, close, modify SL/TP)
  tradeSyncer.onActionNotification = (title, message) => {
    void notificationEmitter.emitUserAction(title, message)
  }

  // 12. TV Alerts module — always initialized; CF Worker URL resolved from DB or env
  const tvAlertsState = new TVAlertsState()
  const signalProcessor = new SignalProcessor(
    stateManager,
    positionManager,
    tradeSyncer,
    notificationEmitter,
    broadcast,
    tvAlertsState,
  )

  const cfWorkerClient = new CFWorkerClient(
    { url: "", secret: "" },
    {
      onSignal: (payload, instrument) => {
        void signalProcessor.processSignal(payload, instrument)
      },
      onConnectionChange: (connected) => {
        tvAlertsState.setCFWorkerConnected(connected)
      },
    },
  )

  // Make cfWorkerClient and tvAlertsState available to server endpoints
  setCFWorkerClient(cfWorkerClient)
  setTVAlertsState(tvAlertsState)

  // Refresh TV alerts active count + daily P&L when positions change
  positionManager.onPositionsChange((positions) => {
    const autoCount = positions.open.filter((t) => tvAlertsState.isAutoTrade(t.sourceTradeId)).length
    tvAlertsState.setActiveAutoPositions(autoCount)

    // Refresh daily P&L from DB (async, best-effort)
    void import("@fxflow/db").then(({ getTodayAutoTradePL }) =>
      getTodayAutoTradePL().then((pl) => tvAlertsState.updateDailyPL(pl)),
    ).catch(() => {})
  })

  // Wire TV alerts status broadcasts
  tvAlertsState.onChange((status) => {
    stateManager.updateTVAlertsStatus(status)
    broadcast({
      type: "tv_alerts_status",
      timestamp: new Date().toISOString(),
      data: status,
    })
  })

  await signalProcessor.start()

  // 12b. AI Condition Monitor — monitors active trade conditions against live prices
  const conditionMonitor = new ConditionMonitor(tradeSyncer, broadcast)
  setConditionMonitor(conditionMonitor)
  await conditionMonitor.start()

  // Wire price ticks to condition monitor (via PositionPriceTracker — the actual pricing stream)
  positionPriceTracker.onPriceTick = (tick) => {
    conditionMonitor.onPriceTick(tick)
  }

  // 12c. Auto Analyzer — automatically analyzes trades on lifecycle events
  // First: clean up any analyses left in "running"/"pending" by a previous crash
  {
    const { resetStuckAnalyses } = await import("@fxflow/db")
    await resetStuckAnalyses()
  }
  const autoAnalyzer = new AutoAnalyzer(stateManager, tradeSyncer, broadcast)
  autoAnalyzer.setConditionMonitor(conditionMonitor)
  autoAnalyzer.start()

  // 12d. Digest Generator — periodic weekly/monthly performance digests
  const digestGenerator = new DigestGenerator()
  digestGenerator.start()
  setDigestGenerator(digestGenerator)

  // Wire trade syncer events to auto analyzer
  tradeSyncer.onPendingCreated = (tradeId) => {
    void autoAnalyzer.onPendingCreated(tradeId)
  }
  tradeSyncer.onOrderFilled = (tradeId) => {
    conditionMonitor.invalidateTradeCache(tradeId)
    void autoAnalyzer.onOrderFilled(tradeId)
    // Check if this fill corresponds to a Trade Finder auto-placed setup
    void tradeFinderScanner.onOrderFilled(tradeId)
  }
  tradeSyncer.onTradeClosed = (tradeId) => {
    void autoAnalyzer.onTradeClosed(tradeId)
    // Cancel all active conditions for the trade when it closes
    void import("@fxflow/db").then(({ cancelConditionsForTrade }) =>
      cancelConditionsForTrade(tradeId)
    ).catch(() => {})
    // Resolve recommendation outcomes for accuracy tracking
    void import("@fxflow/db").then(async ({ resolveOutcomes, db }) => {
      const trade = await db.trade.findUnique({
        where: { id: tradeId },
        select: { realizedPL: true },
      })
      if (trade) {
        const outcome = trade.realizedPL > 0 ? "win" : trade.realizedPL < 0 ? "loss" : "breakeven"
        await resolveOutcomes(tradeId, outcome, trade.realizedPL)
      }
    }).catch((err) =>
      console.warn("[daemon] Failed to resolve recommendation outcomes:", (err as Error).message)
    )
  }

  // 12d. Trade Finder Scanner
  const tradeFinderScanner = new TradeFinderScanner(stateManager, broadcast)
  tradeFinderScanner.setNotificationEmitter(notificationEmitter)
  setTradeFinderScanner(tradeFinderScanner)

  // Wire auto-trade callbacks so the scanner can place/cancel orders
  tradeFinderScanner.setAutoTradeCallbacks(
    // placeOrder
    (req) => tradeSyncer.placeOrder(req),
    // cancelOrder
    (sourceOrderId, reason) => tradeSyncer.cancelOrder(sourceOrderId, reason),
    // hasExistingPosition — check if instrument has any open trade or pending order
    (instrument) => {
      const positions = positionManager.getPositions()
      return (
        positions.open.some((t) => t.instrument === instrument) ||
        positions.pending.some((o) => o.instrument === instrument)
      )
    },
    // getPendingOrderIds — all pending order source IDs from OANDA
    () => {
      const ids = new Set<string>()
      for (const o of positionManager.getPositions().pending) ids.add(o.sourceOrderId)
      return ids
    },
    // getOpenTradeIds — all open trade source IDs from OANDA
    () => {
      const ids = new Set<string>()
      for (const t of positionManager.getPositions().open) ids.add(t.sourceTradeId)
      return ids
    },
  )

  await tradeFinderScanner.start()

  // Resolve CF Worker URL: DB config > env var > local wrangler dev fallback
  {
    const { getTVAlertsConfig } = await import("@fxflow/db")
    const dbConfig = await getTVAlertsConfig()
    const url = dbConfig.cfWorkerUrl || config.cfWorkerWsUrl
    const secret = dbConfig.cfWorkerSecret || config.cfWorkerDaemonSecret
    if (url) {
      cfWorkerClient.reconnect(url, secret)
      console.log("[daemon] TV Alerts: connecting to CF Worker")
    } else {
      // Auto-connect to local wrangler dev (secret matches apps/cf-worker/.dev.vars)
      cfWorkerClient.reconnect("ws://localhost:8787/ws/dev-daemon-secret", "dev-daemon-secret")
      console.log("[daemon] TV Alerts: auto-connecting to local CF Worker dev (localhost:8787)")
    }
  }

  // 13. Start credential watching (triggers initial load + OANDA connection)
  await credentialWatcher.start()

  // 14. Start health checker, account data collector, and trade syncer
  healthChecker.start()
  accountDataCollector.start()
  tradeSyncer.start()

  console.log(
    `[daemon] Ready on ws://localhost:${config.port} and http://localhost:${config.port}/status`,
  )

  // Graceful shutdown
  const shutdown = () => {
    console.log("[daemon] Shutting down...")
    streamClient.disconnect()
    transactionStreamClient.disconnect()
    positionPriceTracker.disconnect()
    chartPriceTracker.disconnect()
    tradeSyncer.stop()
    accountDataCollector.stop()
    healthChecker.stop()
    credentialWatcher.stop()
    marketAnalyzer.stop()
    notificationEmitter.stop()
    cfWorkerClient.disconnect()
    signalProcessor.stop()
    conditionMonitor.stop()
    autoAnalyzer.stop()
    digestGenerator.stop()
    tradeFinderScanner.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((err) => {
  console.error("[daemon] Fatal error:", err)
  process.exit(1)
})
