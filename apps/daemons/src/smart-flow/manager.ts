/**
 * SmartFlow Manager — orchestrates the lifecycle of SmartFlow trades.
 * Handles placement, fill/close callbacks, cancellation, tick delegation, and broadcasting.
 */
import type {
  AnyDaemonMessage,
  SmartFlowConfigData,
  SmartFlowStatusData,
  SmartFlowTradeData,
  SmartFlowTradeUpdateData,
  SmartFlowHealthData,
  SmartFlowConfigRuntimeStatus,
  TradeDirection,
  CloseContext,
} from "@fxflow/types"
import {
  getSmartFlowSettings,
  getSmartFlowConfig,
  getSmartFlowTrade,
  getActiveSmartFlowTrades,
  createSmartFlowTrade,
  updateSmartFlowTradeStatus,
  closeSmartFlowTrade,
  countOpenSmartFlowTrades,
  getSmartFlowTradeByTradeId,
  getSmartFlowTradeBySourceId,
  createTimeEstimate,
  estimateHoldTime,
  countActiveConfigs,
  getSmartFlowConfigs,
  getTodaySmartFlowAiCost,
  getMonthlySmartFlowAiCost,
} from "@fxflow/db"
import {
  computeATR,
  getPipSize,
  calculatePositionSize as sharedCalculatePositionSize,
} from "@fxflow/shared"
import { getPresetDefaults } from "./preset-defaults.js"
import { evaluateConfigHealth } from "./config-health.js"
import { getAdaptiveMinRR, checkCorrelation } from "./entry-filters.js"
import { emitActivity, setActivityBroadcast } from "./activity-feed.js"
import type { StateManager } from "../state-manager.js"
import { getRestUrl } from "../oanda/api-client.js"
import { CandleCache, fetchOandaCandles } from "../trade-finder/candle-cache.js"

interface TradeSyncerRef {
  placeOrder(req: {
    instrument: string
    direction: TradeDirection
    orderType: "MARKET"
    units: number
    stopLoss: number | null
    takeProfit: number | null
    placedVia: "smart_flow"
  }): Promise<{ sourceId: string; filled: boolean; fillPrice?: number }>
  closeTrade(
    sourceTradeId: string,
    units?: number,
    reason?: string,
    attribution?: {
      closedBy: NonNullable<CloseContext["closedBy"]>
      closedByLabel: string
      closedByDetail?: string
    },
  ): Promise<void>
  cancelOrder(sourceOrderId: string, reason?: string, cancelledBy?: string): Promise<void>
}

interface SourcePriorityManagerRef {
  canPlace(
    instrument: string,
    source: "smart_flow",
  ): Promise<{ allowed: true } | { allowed: false; reason: string }>
  releaseLock(instrument: string, source: "smart_flow"): void
}

interface ManagementEngineRef {
  evaluateTick(instrument: string, bid: number, ask: number): void
  loadActiveTrades(trades: SmartFlowTradeData[]): void
  addWaitingEntry(trade: SmartFlowTradeData, config: SmartFlowConfigData): void
  removeWaitingEntry(smartFlowTradeId: string): void
  onEntryTriggered: ((configId: string, smartFlowTradeId: string) => void) | null
}

interface AiMonitorRef {
  start(): Promise<void>
  stop(): void
  addTrade(trade: SmartFlowTradeData, config: SmartFlowConfigData): void
  removeTrade(smartFlowTradeId: string): void
}

interface SmartFlowMarketScannerRef {
  start(): Promise<void>
  stop(): void
  recordTradeOutcome(pl: number): void
  reloadSettings(): Promise<void>
  triggerManualScan(): Promise<void>
  getProgress(): unknown
  getScanLog(): unknown[]
  getDiagnostics(): unknown
  getCircuitBreakerState(): unknown
  resetCircuitBreaker(): void
}

const ATR_TTL = 5 * 60 * 1000
const ATR_PERIOD = 14
const ATR_COUNT = 100
const ATR_TF = "H1"
type PlaceResult = { success: boolean; trade?: SmartFlowTradeData; error?: string }

function formatPreset(preset: string): string {
  const labels: Record<string, string> = {
    momentum_catch: "Momentum Catch",
    steady_growth: "Steady Growth",
    swing_capture: "Swing Capture",
    trend_rider: "Trend Rider",
    recovery: "Recovery",
    custom: "Custom",
  }
  return labels[preset] ?? preset
}

export class SmartFlowManager {
  private stateManager: StateManager
  private broadcast: (msg: AnyDaemonMessage) => void
  private tradeSyncer: TradeSyncerRef | null = null
  private spm: SourcePriorityManagerRef | null = null
  private engine: ManagementEngineRef | null = null
  private atrCache = new Map<string, { atr: number; at: number }>()
  private candleCache = new CandleCache()
  private activeInstruments = new Set<string>()
  private aiMonitor: AiMonitorRef | null = null
  private scanner: SmartFlowMarketScannerRef | null = null
  private enabled = false
  private startedAt: number | null = null
  private lastTickAt: number | null = null
  private tickCount = 0
  private tickWindowStart = Date.now()
  private monitoringInterval: ReturnType<typeof setInterval> | null = null
  /** Tracks how long each config has been blocked (configId → first-blocked timestamp) */
  private blockedSince = new Map<string, number>()
  private readonly BLOCK_ALERT_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

  constructor(stateManager: StateManager, broadcast: (msg: AnyDaemonMessage) => void) {
    this.stateManager = stateManager
    this.broadcast = broadcast
    setActivityBroadcast((type, data) => {
      this.broadcast({
        type,
        timestamp: new Date().toISOString(),
        data,
      } as unknown as AnyDaemonMessage)
    })
  }

  setTradeSyncer(syncer: TradeSyncerRef): void {
    this.tradeSyncer = syncer
  }
  setSourcePriorityManager(spm: SourcePriorityManagerRef): void {
    this.spm = spm
  }
  setPositionManager(_pm: unknown): void {
    /* reserved for future use */
  }
  setManagementEngine(engine: ManagementEngineRef): void {
    this.engine = engine
  }
  setAiMonitor(monitor: AiMonitorRef): void {
    this.aiMonitor = monitor
  }
  setScanner(scanner: SmartFlowMarketScannerRef): void {
    this.scanner = scanner
  }
  getScanner(): SmartFlowMarketScannerRef | null {
    return this.scanner
  }

  async start(): Promise<void> {
    this.startedAt = Date.now()
    const settings = await getSmartFlowSettings()
    this.enabled = settings.enabled
    if (!this.enabled) {
      console.log("[smart-flow] Disabled — skipping startup")
      return
    }

    const activeTrades = await getActiveSmartFlowTrades()
    for (const t of activeTrades) if (t.instrument) this.activeInstruments.add(t.instrument)
    if (this.engine && activeTrades.length > 0) this.engine.loadActiveTrades(activeTrades)

    // Load waiting entries into the engine
    if (this.engine) {
      for (const t of activeTrades) {
        if (t.status === "waiting_entry" && t.instrument && t.configId) {
          const config = await getSmartFlowConfig(t.configId)
          if (config) this.engine.addWaitingEntry(t, config)
        }
      }
    }

    // Wire the smart entry trigger callback
    if (this.engine) {
      this.engine.onEntryTriggered = (configId: string, smartFlowTradeId: string) => {
        void this.handleSmartEntryTriggered(configId, smartFlowTradeId)
      }
    }

    if (this.stateManager.getCredentials()) {
      await Promise.allSettled([...this.activeInstruments].map((i) => this.calculateAtr(i)))
    }
    console.log(
      `[smart-flow] Started: ${activeTrades.length} trades, ${this.activeInstruments.size} instruments`,
    )

    const configCount = await countActiveConfigs()
    const instrumentList = [...this.activeInstruments].map((i) => i.replace("_", "/")).join(", ")
    emitActivity(
      "engine_started",
      this.activeInstruments.size > 0
        ? `SmartFlow is running — watching ${instrumentList}`
        : configCount > 0
          ? `SmartFlow is running — ${configCount} trade plan${configCount > 1 ? "s" : ""} ready`
          : "SmartFlow is running — create a trade plan to get started",
      {
        detail:
          activeTrades.length > 0
            ? `${activeTrades.length} active trade${activeTrades.length > 1 ? "s" : ""} recovered`
            : undefined,
      },
    )

    // Start AI monitor and register existing trades
    if (this.aiMonitor) {
      await this.aiMonitor.start()
      for (const t of activeTrades) {
        if (t.status !== "waiting_entry" && t.status !== "closed" && t.configId) {
          const config = await getSmartFlowConfig(t.configId)
          if (config) this.aiMonitor.addTrade(t, config)
        }
      }
    }

    // Repair configs with missing ATR multiples (pre-populate from preset defaults)
    await this.repairMissingAtrMultiples()

    // Migrate existing configs: ensure AI is enabled (was defaulting to "off")
    await this.migrateAiDefaults()

    this.startMonitoringUpdates()

    // Auto-place trades for active configs that have no associated trade yet.
    // Delayed 5s to allow OANDA connection to fully establish.
    setTimeout(() => void this.autoPlaceActiveConfigs(), 5_000)
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.atrCache.clear()
    this.activeInstruments.clear()
    console.log("[smart-flow] Stopped")
    emitActivity("engine_stopped", "SmartFlow engine stopped")
  }

  onPriceTick(instrument: string, bid: number, ask: number): void {
    if (!this.enabled || !this.activeInstruments.has(instrument)) return
    this.lastTickAt = Date.now()
    this.tickCount++
    // Reset tick window every 60 seconds
    if (Date.now() - this.tickWindowStart > 60_000) {
      this.tickCount = 1
      this.tickWindowStart = Date.now()
    }
    this.engine?.evaluateTick(instrument, bid, ask)
  }

  async placeMarketEntry(configId: string): Promise<PlaceResult> {
    if (!this.tradeSyncer) return { success: false, error: "Trade syncer not bound" }
    const config = await getSmartFlowConfig(configId)
    if (!config) return { success: false, error: `Config not found: ${configId}` }

    if (this.spm) {
      const check = await this.spm.canPlace(config.instrument, "smart_flow")
      if (!check.allowed) {
        emitActivity("entry_blocked", check.reason, {
          instrument: config.instrument,
          severity: "warning",
          configId: config.id,
        })
        return { success: false, error: check.reason }
      }
    }

    try {
      // Currency correlation guard: max 2 same-currency same-direction
      const activeTrades = await getActiveSmartFlowTrades()
      const openPositions = activeTrades
        .filter((t) => t.status !== "waiting_entry" && t.status !== "closed" && t.instrument)
        .map((t) => ({ instrument: t.instrument!, direction: t.direction ?? "long" }))
      const corrCheck = checkCorrelation(
        config.instrument,
        config.direction as "long" | "short",
        openPositions,
        2,
      )
      if (!corrCheck.passed) {
        this.unlock(config.instrument)
        emitActivity(
          "entry_blocked",
          `${config.instrument.replace("_", "/")} — ${corrCheck.reason}`,
          {
            instrument: config.instrument,
            severity: "warning",
            configId: config.id,
          },
        )
        return { success: false, error: corrCheck.reason ?? "Correlation limit exceeded" }
      }

      const atr = await this.calculateAtr(config.instrument)
      if (atr === null) {
        this.unlock(config.instrument)
        return { success: false, error: `ATR failed for ${config.instrument}` }
      }

      const balance = this.stateManager.getSnapshot().accountOverview?.summary.balance ?? 0
      if (balance <= 0) {
        this.unlock(config.instrument)
        return { success: false, error: "Account balance unavailable" }
      }

      const units = this.calculatePositionSize(config, balance, atr)
      const sltp = this.calculateSLTP(config, null, atr)
      if (sltp.error) {
        this.unlock(config.instrument)
        return { success: false, error: sltp.error }
      }

      const result = await this.tradeSyncer.placeOrder({
        instrument: config.instrument,
        direction: config.direction as TradeDirection,
        orderType: "MARKET",
        units,
        stopLoss: sltp.stopLoss,
        takeProfit: sltp.takeProfit,
        placedVia: "smart_flow",
      })

      // Estimate expected hold time from historical SmartFlowTimeEstimate rows.
      // Uses the TP pip distance (from config or derived from ATR) as the target.
      const pipSize = getPipSize(config.instrument)
      const preset = getPresetDefaults(config.preset)
      const tpAtrMultiple = config.takeProfitAtrMultiple ?? preset.tpAtrMultiple ?? 2.0
      const targetPips = config.takeProfitPips ?? (atr > 0 ? (tpAtrMultiple * atr) / pipSize : 0)
      const estimate = await estimateHoldTime(
        config.instrument,
        config.preset,
        config.direction,
        targetPips,
      ).catch(() => null)

      const trade = await createSmartFlowTrade({
        configId: config.id,
        sourceTradeId: result.sourceId,
        status: result.filled ? "open" : "pending",
        entryPrice: result.fillPrice ?? undefined,
        currentPhase: result.filled ? "entry" : "entry",
        estimatedHours: estimate?.estimatedHours,
        estimatedLow: estimate?.low,
        estimatedHigh: estimate?.high,
      })

      this.activeInstruments.add(config.instrument)
      this.unlock(config.instrument)
      this.emitUpdate(trade, "placed", "Market entry placed")
      emitActivity(
        "entry_placed",
        `Market order placed on ${config.instrument.replace("_", "/")}`,
        {
          instrument: config.instrument,
          severity: "success",
          configId: config.id,
          tradeId: trade.id,
        },
      )
      console.log(
        `[smart-flow] Market entry: ${config.instrument} ${config.direction} (${result.sourceId})`,
      )
      return { success: true, trade }
    } catch (err) {
      this.unlock(config.instrument)
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[smart-flow] Market entry failed for ${config.instrument}:`, msg)
      return { success: false, error: msg }
    }
  }

  async createSmartEntry(configId: string): Promise<PlaceResult> {
    const config = await getSmartFlowConfig(configId)
    if (!config) return { success: false, error: `Config not found: ${configId}` }
    const trade = await createSmartFlowTrade({
      configId: config.id,
      status: "waiting_entry",
      currentPhase: "entry",
    })
    this.activeInstruments.add(config.instrument)
    if (this.engine) this.engine.addWaitingEntry(trade, config)
    this.emitUpdate(trade, "created", "Smart entry — waiting for conditions")
    emitActivity(
      "entry_placed",
      `Smart entry created for ${config.instrument.replace("_", "/")} — waiting for conditions`,
      {
        instrument: config.instrument,
        configId: config.id,
      },
    )
    console.log(`[smart-flow] Smart entry created: ${config.instrument} ${config.direction}`)
    return { success: true, trade }
  }

  async onOrderFilled(tradeId: string, sourceTradeId: string): Promise<void> {
    const sf =
      (await getSmartFlowTradeByTradeId(tradeId)) ??
      (await getSmartFlowTradeBySourceId(sourceTradeId))
    if (!sf) return
    await updateSmartFlowTradeStatus(sf.id, "managing", { currentPhase: "entry" })

    // Register with AI monitor for ongoing evaluation
    if (this.aiMonitor && sf.configId) {
      const config = await getSmartFlowConfig(sf.configId)
      if (config) this.aiMonitor.addTrade(sf, config)
    }

    this.emitUpdate(sf, "filled", "Order filled — management active")
    emitActivity(
      "entry_filled",
      `Order filled on ${(sf.instrument ?? "UNKNOWN").replace("_", "/")}`,
      {
        instrument: sf.instrument ?? undefined,
        severity: "success",
        tradeId: sf.id,
      },
    )
    console.log(`[smart-flow] Filled: ${sf.instrument} (${sf.id})`)
  }

  async onTradeClosed(tradeId: string): Promise<void> {
    const sf = await getSmartFlowTradeByTradeId(tradeId)
    if (!sf) return
    this.aiMonitor?.removeTrade(sf.id)
    await closeSmartFlowTrade(sf.id)

    if (sf.instrument && sf.preset && sf.direction && sf.entryPrice) {
      const hours = (Date.now() - new Date(sf.createdAt).getTime()) / 3_600_000
      const config = await getSmartFlowConfig(sf.configId).catch(() => null)
      // Prefer the explicit pip target from config, else infer from realized pips.
      const targetPips =
        config?.takeProfitPips ??
        (sf.realizedPips != null && sf.realizedPips > 0 ? sf.realizedPips : 0)
      // Outcome from the Trade join when present; fall back to safetyNet / pip sign.
      const outcome: "win" | "loss" | "safety_net" = sf.safetyNetTriggered
        ? "safety_net"
        : sf.realizedPL != null
          ? sf.realizedPL > 0
            ? "win"
            : "loss"
          : "loss"
      createTimeEstimate({
        instrument: sf.instrument,
        preset: sf.preset,
        direction: sf.direction,
        targetPips,
        actualHours: Math.round(hours * 100) / 100,
        outcome,
      }).catch((e) => console.warn("[smart-flow] Time estimate failed:", (e as Error).message))
    }

    if (sf.instrument) {
      const rest = await getActiveSmartFlowTrades()
      if (!rest.some((t) => t.instrument === sf.instrument))
        this.activeInstruments.delete(sf.instrument!)
    }
    this.unlock(sf.instrument ?? "")
    this.emitUpdate(sf, "closed", "Trade closed")
    emitActivity(
      "trade_closed",
      `Trade closed on ${(sf.instrument ?? "UNKNOWN").replace("_", "/")}`,
      {
        instrument: sf.instrument ?? undefined,
        tradeId: sf.id,
      },
    )
    // Notify scanner circuit breaker of trade outcome
    // P&L is tracked via OANDA reconciliation, not here — use a simple heuristic
    // (positive outcome vs. negative) since the trade sync will have the real P&L
    this.scanner?.recordTradeOutcome(0) // placeholder — actual P&L wired in index.ts callback
    console.log(`[smart-flow] Closed: ${sf.instrument} (${sf.id})`)
  }

  async cancelSmartFlowTrade(id: string): Promise<{ success: boolean; error?: string }> {
    if (!this.tradeSyncer) return { success: false, error: "Trade syncer not bound" }
    const sf = await getSmartFlowTrade(id)
    if (!sf) return { success: false, error: `SmartFlow trade not found: ${id}` }

    try {
      if (sf.status === "waiting_entry") {
        await closeSmartFlowTrade(sf.id)
      } else if (sf.status === "pending" && sf.sourceTradeId) {
        await this.tradeSyncer.cancelOrder(sf.sourceTradeId, "SmartFlow cancelled by user")
        await closeSmartFlowTrade(sf.id)
      } else if (sf.sourceTradeId) {
        // User-initiated cancellation from the SmartFlow UI — attribute to user
        // explicitly so the close badge doesn't degrade to the generic "Manual".
        await this.tradeSyncer.closeTrade(sf.sourceTradeId, undefined, "SmartFlow cancelled", {
          closedBy: "user",
          closedByLabel: "Manual Close",
          closedByDetail: "SmartFlow cancelled from UI",
        })
        await closeSmartFlowTrade(sf.id)
      }
      if (sf.instrument) this.unlock(sf.instrument)
      this.emitUpdate(sf, "cancelled", "Cancelled by user")
      emitActivity(
        "trade_closed",
        `Trade cancelled on ${(sf.instrument ?? "UNKNOWN").replace("_", "/")}`,
        {
          instrument: sf.instrument ?? undefined,
          severity: "warning",
          tradeId: sf.id,
        },
      )
      console.log(`[smart-flow] Cancelled: ${sf.instrument} (${sf.id})`)
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[smart-flow] Cancel failed for ${sf.id}:`, msg)
      return { success: false, error: msg }
    }
  }

  async getStatus(): Promise<SmartFlowStatusData> {
    const [openTrades, activeConfigs, aiCostToday, aiCostMonthly, settings] = await Promise.all([
      countOpenSmartFlowTrades(),
      countActiveConfigs(),
      getTodaySmartFlowAiCost(),
      getMonthlySmartFlowAiCost(),
      getSmartFlowSettings(),
    ])
    return {
      enabled: this.enabled,
      activeConfigs,
      openTrades,
      waitingEntries: 0,
      todayPL: 0,
      todayTradeCount: 0,
      aiCostToday,
      aiCostMonthly,
      aiBudgetDailyUsd: settings.aiBudgetDailyUsd,
      aiBudgetMonthlyUsd: settings.aiBudgetMonthlyUsd,
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Check all active configs and auto-place trades for any that don't have
   * an associated active trade. Called on startup after OANDA connects, and
   * can be called again when configs are activated.
   */
  private async autoPlaceActiveConfigs(silent = false): Promise<void> {
    if (!this.tradeSyncer) return

    try {
      const configs = await getSmartFlowConfigs()
      const activeConfigs = configs.filter((c) => c.isActive)
      const activeTrades = await getActiveSmartFlowTrades()

      // Build set of configIds that already have active trades
      const configsWithTrades = new Set(activeTrades.map((t) => t.configId).filter(Boolean))

      for (const config of activeConfigs) {
        if (configsWithTrades.has(config.id)) {
          if (!silent) {
            emitActivity(
              "monitoring_update",
              `${config.instrument.replace("_", "/")} — trade is active, managing with ${formatPreset(config.preset)} strategy`,
              { instrument: config.instrument, configId: config.id },
            )
          }
          continue
        }

        // Active config with no trade — attempt placement
        if (!silent) {
          emitActivity(
            "entry_watching",
            `${config.instrument.replace("_", "/")} — checking market conditions to place your trade`,
            { instrument: config.instrument, configId: config.id },
          )
        }

        if (config.entryMode === "smart_entry") {
          const result = await this.createSmartEntry(config.id)
          if (result.success) {
            emitActivity(
              "entry_watching",
              `${config.instrument.replace("_", "/")} — watching for entry price${config.entryPrice != null ? ` at ${config.entryPrice}` : ""}`,
              { instrument: config.instrument, configId: config.id, severity: "success" },
            )
          } else if (!silent) {
            emitActivity(
              "entry_blocked",
              `${config.instrument.replace("_", "/")} — couldn't set up smart entry: ${result.error}`,
              { instrument: config.instrument, configId: config.id, severity: "warning" },
            )
          }
        } else {
          const result = await this.placeMarketEntry(config.id)
          if (result.success) {
            this.blockedSince.delete(config.id) // Clear block tracker on success
            emitActivity(
              "entry_placed",
              `${config.instrument.replace("_", "/")} — trade placed! SmartFlow is now managing it`,
              { instrument: config.instrument, configId: config.id, severity: "success" },
            )
          } else {
            // Track block duration for prolonged-block notifications
            if (!this.blockedSince.has(config.id)) {
              this.blockedSince.set(config.id, Date.now())
            }
            const blockedMs = Date.now() - this.blockedSince.get(config.id)!
            const blockedHours = Math.floor(blockedMs / 3_600_000)

            if (!silent) {
              emitActivity(
                "entry_blocked",
                `${config.instrument.replace("_", "/")} — couldn't place trade: ${result.error}`,
                { instrument: config.instrument, configId: config.id, severity: "warning" },
              )
            } else if (blockedMs > this.BLOCK_ALERT_THRESHOLD_MS && blockedHours > 0) {
              // Emit a periodic alert for prolonged blocks (every 2 hours after first 2 hours)
              if (blockedMs % (2 * 3_600_000) < 2 * 60_000) {
                emitActivity(
                  "entry_blocked",
                  `${config.instrument.replace("_", "/")} has been blocked for ${blockedHours}h: ${result.error}`,
                  {
                    instrument: config.instrument,
                    configId: config.id,
                    severity: "error",
                    detail: "Consider reviewing the trade plan settings or market conditions",
                  },
                )
              }
            }
          }
        }
      }

      const pausedCount = configs.filter((c) => !c.isActive).length
      if (pausedCount > 0) {
        emitActivity(
          "monitoring_update",
          `${pausedCount} trade plan${pausedCount > 1 ? "s are" : " is"} paused`,
          { detail: "Activate them from the Trade Plans tab to start trading" },
        )
      }
    } catch (err) {
      console.error("[smart-flow] Auto-place failed:", (err as Error).message)
    }
  }

  private async handleSmartEntryTriggered(
    configId: string,
    smartFlowTradeId: string,
  ): Promise<void> {
    console.log(`[smart-flow] Smart entry triggered for config ${configId}`)
    emitActivity("entry_placed", `Entry conditions met — placing order now`, {
      configId,
      tradeId: smartFlowTradeId,
      severity: "success",
    })
    const result = await this.placeMarketEntry(configId)
    if (result.success) {
      void closeSmartFlowTrade(smartFlowTradeId).catch((err) =>
        console.error(
          "[smart-flow] Failed to close waiting_entry trade after trigger:",
          (err as Error).message,
        ),
      )
    } else {
      emitActivity("entry_blocked", `Smart entry failed: ${result.error ?? "unknown error"}`, {
        configId,
        tradeId: smartFlowTradeId,
        severity: "error",
      })
    }
  }

  async calculateAtr(instrument: string, timeframe = ATR_TF): Promise<number | null> {
    const key = `${instrument}:${timeframe}`
    const c = this.atrCache.get(key)
    if (c && Date.now() - c.at < ATR_TTL) return c.atr

    const creds = this.stateManager.getCredentials()
    if (!creds) return null
    try {
      const candles = await fetchOandaCandles(
        instrument,
        timeframe,
        ATR_COUNT,
        getRestUrl(creds.mode),
        creds.token,
        this.candleCache,
      )
      if (candles.length < ATR_PERIOD + 1) return null
      const vals = computeATR(candles, ATR_PERIOD)
      const atr = vals[vals.length - 1]
      if (!atr || atr <= 0) return null
      this.atrCache.set(key, { atr, at: Date.now() })
      return atr
    } catch (err) {
      console.warn(`[smart-flow] ATR failed for ${instrument}:`, (err as Error).message)
      return null
    }
  }

  calculatePositionSize(config: SmartFlowConfigData, balance: number, atr: number): number {
    const pip = getPipSize(config.instrument)
    const preset = getPresetDefaults(config.preset)
    switch (config.positionSizeMode) {
      case "risk_percent": {
        const slAtrMultiple = config.stopLossAtrMultiple ?? preset.slAtrMultiple ?? 1.5
        const slPips = config.stopLossPips ?? slAtrMultiple * (atr / pip)
        return sharedCalculatePositionSize({
          mode: "risk_percent",
          riskPercent: config.positionSizeValue,
          accountBalance: balance,
          instrument: config.instrument,
          riskPips: slPips,
        })
      }
      case "fixed_units":
        return sharedCalculatePositionSize({
          mode: "fixed_units",
          units: config.positionSizeValue,
        })
      case "fixed_lots":
        return sharedCalculatePositionSize({
          mode: "fixed_lots",
          lots: config.positionSizeValue,
        })
      case "kelly":
        return sharedCalculatePositionSize({
          mode: "kelly",
          accountBalance: balance,
          atr,
          instrument: config.instrument,
        })
      default:
        return sharedCalculatePositionSize({
          mode: "fixed_units",
          units: config.positionSizeValue,
        })
    }
  }

  calculateSLTP(
    config: SmartFlowConfigData,
    entry: number | null,
    atr: number,
    regime?: string | null,
  ): { stopLoss: number | null; takeProfit: number | null; error?: string } {
    const pip = getPipSize(config.instrument)
    const long = config.direction === "long"

    // Resolve ATR multiples: config → preset defaults → hardcoded fallback
    const preset = getPresetDefaults(config.preset)
    const slAtrMultiple = config.stopLossAtrMultiple ?? preset.slAtrMultiple ?? 1.5
    const tpAtrMultiple = config.takeProfitAtrMultiple ?? preset.tpAtrMultiple ?? 2.0

    const sl = config.stopLossPips != null ? config.stopLossPips * pip : slAtrMultiple * atr
    const tp = config.takeProfitPips != null ? config.takeProfitPips * pip : tpAtrMultiple * atr

    // Adaptive R:R: adjust minRiskReward based on session and market regime
    const effectiveMinRR = getAdaptiveMinRR(config.minRiskReward, regime ?? null)

    // trend_rider has tpAtrMultiple=0 (no fixed TP, trailing only) — skip R:R check
    if (sl > 0 && tp > 0 && tp / sl < effectiveMinRR)
      return {
        stopLoss: null,
        takeProfit: null,
        error: `R:R ${(tp / sl).toFixed(2)} below adaptive min ${effectiveMinRR.toFixed(2)} (base: ${config.minRiskReward})`,
      }
    if (entry == null) return { stopLoss: null, takeProfit: null }
    return {
      stopLoss: long ? entry - sl : entry + sl,
      takeProfit: tp > 0 ? (long ? entry + tp : entry - tp) : null,
    }
  }

  async getHealthData(): Promise<SmartFlowHealthData> {
    const [openTrades, activeConfigCount, activeTrades] = await Promise.all([
      countOpenSmartFlowTrades(),
      countActiveConfigs(),
      getActiveSmartFlowTrades(),
    ])
    const atrEntries = [...this.atrCache.entries()].map(([key, v]) => ({
      instrument: key.split(":")[0] ?? key,
      atr: v.atr,
      fetchedAt: new Date(v.at).toISOString(),
    }))
    // Surface the most recent management action across active trades. Uses the
    // freshly-wired lastManagementAction column stamped by appendManagementLog /
    // appendPartialCloseLog / closeSmartFlowTrade.
    const latestAction = activeTrades
      .filter((t) => t.lastManagementAction)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    return {
      engineRunning: this.enabled,
      enabled: this.enabled,
      subscribedInstruments: [...this.activeInstruments],
      activeRuleCount: this.activeInstruments.size * 5, // 5 rule types per instrument
      activeTrades: openTrades,
      activeConfigs: activeConfigCount,
      lastManagementAction: latestAction?.lastManagementAction ?? null,
      lastManagementActionAt: latestAction?.createdAt ?? null,
      lastTickAt: this.lastTickAt ? new Date(this.lastTickAt).toISOString() : null,
      ticksPerSecond:
        this.tickCount > 0
          ? Math.round(this.tickCount / Math.max(1, (Date.now() - this.tickWindowStart) / 1000))
          : 0,
      atrCache: atrEntries,
      spreadCache: [],
      priorityMode: "manual",
      aiDailySpend: 0,
      aiDailyBudget: 1.0,
      upSince: this.startedAt ? new Date(this.startedAt).toISOString() : null,
    }
  }

  async getConfigRuntimeStatuses(): Promise<SmartFlowConfigRuntimeStatus[]> {
    const [configs, activeTrades, settings] = await Promise.all([
      getSmartFlowConfigs(),
      getActiveSmartFlowTrades(),
      getSmartFlowSettings(),
    ])
    const configsWithTrades = new Set(activeTrades.map((t) => t.configId).filter(Boolean))
    const waitingEntries = new Set(
      activeTrades.filter((t) => t.status === "waiting_entry").map((t) => t.configId),
    )
    const balance = this.stateManager.getSnapshot().accountOverview?.summary.balance ?? 0

    return Promise.all(
      configs.map(async (c) => {
        const atrKey = `${c.instrument}:H1`
        const atrEntry = this.atrCache.get(atrKey)
        const hasActiveTrade = configsWithTrades.has(c.id)

        // Check source priority for health evaluation
        let sourcePriorityBlocked = false
        let sourcePriorityReason: string | null = null
        if (this.spm && !hasActiveTrade) {
          const check = await this.spm.canPlace(c.instrument, "smart_flow")
          if (!check.allowed) {
            sourcePriorityBlocked = true
            sourcePriorityReason = check.reason
          }
        }

        const health = evaluateConfigHealth(c, {
          atr: atrEntry?.atr ?? null,
          hasActiveTrade,
          isWaitingEntry: waitingEntries.has(c.id),
          balance,
          sourcePriorityBlocked,
          sourcePriorityReason,
          spreadPips: null,
          scannerEnabled: settings.scannerEnabled,
        })

        return {
          configId: c.id,
          receiving_ticks: hasActiveTrade,
          lastTickAt:
            this.lastTickAt && hasActiveTrade ? new Date(this.lastTickAt).toISOString() : null,
          currentAtr: atrEntry?.atr ?? null,
          currentSpread: null,
          averageSpread: null,
          spreadMultiple: null,
          spreadStatus: "normal" as const,
          activeTradeId: null,
          managementPhase: null,
          nextAiCheck: null,
          health,
        }
      }),
    )
  }

  private startMonitoringUpdates(): void {
    if (this.monitoringInterval) clearInterval(this.monitoringInterval)
    this.monitoringInterval = setInterval(
      () => {
        void this.emitMonitoringSummary()
        // Retry placing trades for active configs that were previously blocked
        // (e.g., instrument freed up after another source's trade closed)
        // Silent mode: only log successful placements, not repeated blocks
        void this.autoPlaceActiveConfigs(true)
      },
      2 * 60 * 1000,
    ) // every 2 minutes
  }

  private async emitMonitoringSummary(): Promise<void> {
    if (!this.enabled) return
    const trades = await getActiveSmartFlowTrades()
    const activeTrades = trades.filter((t) => t.status !== "waiting_entry" && t.status !== "closed")
    const waitingTrades = trades.filter((t) => t.status === "waiting_entry")

    if (activeTrades.length === 0 && waitingTrades.length === 0) return

    const parts: string[] = []
    if (activeTrades.length > 0) {
      parts.push(`${activeTrades.length} active trade${activeTrades.length > 1 ? "s" : ""}`)
    }
    if (waitingTrades.length > 0) {
      parts.push(`${waitingTrades.length} watching for entry`)
    }

    emitActivity("monitoring_update", `SmartFlow update: ${parts.join(", ")}`, {
      detail: `Watching ${this.activeInstruments.size} currency pairs — prices updating ${this.getTickRate()}/sec`,
    })
  }

  private getTickRate(): number {
    if (this.tickCount === 0) return 0
    return Math.round(this.tickCount / Math.max(1, (Date.now() - this.tickWindowStart) / 1000))
  }

  private unlock(instrument: string): void {
    this.spm?.releaseLock(instrument, "smart_flow")
  }

  /** Startup repair: populate missing ATR multiples from preset defaults so R:R checks pass. */
  private async repairMissingAtrMultiples(): Promise<void> {
    try {
      const configs = await getSmartFlowConfigs()
      let repaired = 0
      for (const c of configs) {
        if (c.stopLossAtrMultiple == null || c.takeProfitAtrMultiple == null) {
          const defaults = getPresetDefaults(c.preset)
          const { updateSmartFlowConfig } = await import("@fxflow/db")
          await updateSmartFlowConfig(c.id, {
            stopLossAtrMultiple: c.stopLossAtrMultiple ?? defaults.slAtrMultiple,
            takeProfitAtrMultiple: c.takeProfitAtrMultiple ?? defaults.tpAtrMultiple,
          })
          repaired++
        }
      }
      if (repaired > 0) {
        console.log(`[smart-flow] Repaired ${repaired} configs: applied preset ATR multiples`)
        emitActivity(
          "monitoring_update",
          `Repaired ${repaired} trade plan${repaired > 1 ? "s" : ""} with missing SL/TP settings`,
          { severity: "warning" },
        )
      }
    } catch (err) {
      console.error("[smart-flow] ATR multiples repair failed:", (err as Error).message)
    }
  }

  /** One-time migration: enable AI on configs that still have aiMode="off" from old defaults. */
  private async migrateAiDefaults(): Promise<void> {
    try {
      const configs = await getSmartFlowConfigs()
      const allTogglesEnabled = JSON.stringify({
        moveSL: true,
        moveTP: true,
        breakeven: true,
        partialClose: true,
        closeProfit: true,
        preemptiveSafetyClose: true,
        cancelEntry: true,
        adjustTrail: true,
      })

      let migrated = 0
      for (const c of configs) {
        if (c.aiMode === "off") {
          const { updateSmartFlowConfig } = await import("@fxflow/db")
          await updateSmartFlowConfig(c.id, {
            aiMode: "auto_selective",
            aiMonitorIntervalHours: 1,
            aiActionToggles: JSON.parse(allTogglesEnabled),
          })
          migrated++
        }
      }

      if (migrated > 0) {
        console.log(`[smart-flow] Migrated ${migrated} configs: AI mode → auto_selective`)
      }
    } catch (err) {
      console.error("[smart-flow] AI defaults migration failed:", (err as Error).message)
    }
  }

  private emitUpdate(trade: SmartFlowTradeData, action: string, detail: string): void {
    const data: SmartFlowTradeUpdateData = {
      smartFlowTradeId: trade.id,
      tradeId: trade.tradeId,
      instrument: trade.instrument ?? "UNKNOWN",
      action,
      phase: trade.currentPhase,
      detail,
    }
    this.broadcast({
      type: "smart_flow_trade_update",
      timestamp: new Date().toISOString(),
      data,
    } as unknown as AnyDaemonMessage)
  }
}
