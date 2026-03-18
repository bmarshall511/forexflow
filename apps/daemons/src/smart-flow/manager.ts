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
  countActiveConfigs,
  getSmartFlowConfigs,
} from "@fxflow/db"
import { computeATR, getPipSize } from "@fxflow/shared"
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
  closeTrade(sourceTradeId: string, units?: number, reason?: string): Promise<void>
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

const ATR_TTL = 5 * 60 * 1000
const ATR_PERIOD = 14
const ATR_COUNT = 100
const ATR_TF = "H1"
type PlaceResult = { success: boolean; trade?: SmartFlowTradeData; error?: string }

export class SmartFlowManager {
  private stateManager: StateManager
  private broadcast: (msg: AnyDaemonMessage) => void
  private tradeSyncer: TradeSyncerRef | null = null
  private spm: SourcePriorityManagerRef | null = null
  private engine: ManagementEngineRef | null = null
  private atrCache = new Map<string, { atr: number; at: number }>()
  private candleCache = new CandleCache()
  private activeInstruments = new Set<string>()
  private enabled = false
  private startedAt: number | null = null
  private lastTickAt: number | null = null
  private tickCount = 0
  private tickWindowStart = Date.now()
  private monitoringInterval: ReturnType<typeof setInterval> | null = null

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

    this.startMonitoringUpdates()
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

      const trade = await createSmartFlowTrade({
        configId: config.id,
        sourceTradeId: result.sourceId,
        status: result.filled ? "open" : "pending",
        entryPrice: result.fillPrice ?? undefined,
        currentPhase: result.filled ? "entry" : "entry",
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
    await closeSmartFlowTrade(sf.id)

    if (sf.instrument && sf.preset && sf.direction && sf.entryPrice) {
      const hours = (Date.now() - new Date(sf.createdAt).getTime()) / 3_600_000
      createTimeEstimate({
        instrument: sf.instrument,
        preset: sf.preset,
        direction: sf.direction,
        targetPips: 0,
        actualHours: Math.round(hours * 100) / 100,
        outcome: "closed",
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
        await this.tradeSyncer.closeTrade(sf.sourceTradeId, undefined, "SmartFlow cancelled")
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
    const [openTrades, activeConfigs] = await Promise.all([
      countOpenSmartFlowTrades(),
      countActiveConfigs(),
    ])
    return {
      enabled: this.enabled,
      activeConfigs,
      openTrades,
      waitingEntries: 0,
      todayPL: 0,
      todayTradeCount: 0,
      aiCostToday: 0,
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

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
    switch (config.positionSizeMode) {
      case "risk_percent": {
        const risk = balance * (config.positionSizeValue / 100)
        const slPips = config.stopLossPips ?? (config.stopLossAtrMultiple ?? 1.5) * (atr / pip)
        return Math.max(Math.floor(risk / (slPips * pip)), 1)
      }
      case "fixed_units":
        return Math.max(Math.floor(config.positionSizeValue), 1)
      case "fixed_lots":
        return Math.max(Math.floor(config.positionSizeValue * 100_000), 1)
      case "kelly":
        return Math.max(Math.floor((balance * 0.01) / (atr * 1.5)), 1)
      default:
        return Math.max(Math.floor(config.positionSizeValue), 1)
    }
  }

  calculateSLTP(
    config: SmartFlowConfigData,
    entry: number | null,
    atr: number,
  ): { stopLoss: number | null; takeProfit: number | null; error?: string } {
    const pip = getPipSize(config.instrument)
    const long = config.direction === "long"
    const sl =
      config.stopLossPips != null
        ? config.stopLossPips * pip
        : (config.stopLossAtrMultiple ?? 1.5) * atr
    const tp =
      config.takeProfitPips != null
        ? config.takeProfitPips * pip
        : (config.takeProfitAtrMultiple ?? 2.0) * atr
    if (sl > 0 && tp / sl < config.minRiskReward)
      return {
        stopLoss: null,
        takeProfit: null,
        error: `R:R ${(tp / sl).toFixed(2)} below min ${config.minRiskReward}`,
      }
    if (entry == null) return { stopLoss: null, takeProfit: null }
    return { stopLoss: long ? entry - sl : entry + sl, takeProfit: long ? entry + tp : entry - tp }
  }

  async getHealthData(): Promise<SmartFlowHealthData> {
    const [openTrades, activeConfigCount] = await Promise.all([
      countOpenSmartFlowTrades(),
      countActiveConfigs(),
    ])
    const atrEntries = [...this.atrCache.entries()].map(([key, v]) => ({
      instrument: key.split(":")[0] ?? key,
      atr: v.atr,
      fetchedAt: new Date(v.at).toISOString(),
    }))
    return {
      engineRunning: this.enabled,
      enabled: this.enabled,
      subscribedInstruments: [...this.activeInstruments],
      activeRuleCount: this.activeInstruments.size * 5, // 5 rule types per instrument
      activeTrades: openTrades,
      activeConfigs: activeConfigCount,
      lastManagementAction: null, // TODO: wire from management engine
      lastManagementActionAt: null,
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
    const configs = await getSmartFlowConfigs()
    return configs.map((c) => {
      const atrKey = `${c.instrument}:H1`
      const atrEntry = this.atrCache.get(atrKey)
      const hasActiveTrade = this.activeInstruments.has(c.instrument)
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
      }
    })
  }

  private startMonitoringUpdates(): void {
    if (this.monitoringInterval) clearInterval(this.monitoringInterval)
    this.monitoringInterval = setInterval(
      () => {
        void this.emitMonitoringSummary()
      },
      5 * 60 * 1000,
    ) // every 5 minutes
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
