/**
 * SmartFlow Management Engine — tick-by-tick trade management.
 *
 * Evaluates management rules on every price tick for SmartFlow-managed instruments.
 * Rule evaluation order (short-circuits after close actions):
 *   1. Safety net checks (drawdown, hold time, financing)
 *   2. Take profit check (trend_rider fallback)
 *   3. Breakeven check
 *   4. Trailing stop check
 *   5. Partial close check
 *
 * Session awareness multiplies pip-based thresholds:
 *   - Primary session: 1.0x
 *   - Overlap session: 0.8x
 *   - Off session: 1.5x
 *
 * @module management-engine
 */

import { getPipSize } from "@fxflow/shared"
import { getCurrentSession } from "@fxflow/shared"
import type {
  SmartFlowTradeData,
  SmartFlowConfigData,
  SmartFlowEntryCondition,
  SmartFlowManagementEntry,
  SmartFlowPartialCloseEntry,
  SmartFlowPartialCloseRule,
  SmartFlowTradeUpdateData,
  SmartFlowPhase,
  SmartFlowActivityType,
  CloseContext,
} from "@fxflow/types"
import type { PositionManager } from "../positions/position-manager.js"
import { emitActivity } from "./activity-feed.js"

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Minimal trade syncer interface (late-bound via setter). */
interface TradeSyncerLike {
  modifyTradeSLTP(sourceTradeId: string, stopLoss?: number, takeProfit?: number): Promise<unknown>
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
}

/** In-memory state tracked per waiting smart entry. */
interface SmartFlowWaitingEntryState {
  smartFlowTradeId: string
  configId: string
  instrument: string
  direction: "long" | "short"
  entryConditions: SmartFlowEntryCondition[]
  entryPrice: number | null
  entryExpireHours: number | null
  createdAt: number // epoch ms
  /** Epoch ms of last proximity event emission. */
  lastProximityEmitAt: number
}

/** In-memory state tracked per active SmartFlow trade. */
interface SmartFlowTradeState {
  smartFlowTradeId: string
  configId: string
  tradeId: string | null
  sourceTradeId: string
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentUnits: number
  /** Epoch ms of last SL/TP modification via OANDA API. */
  lastModifyAt: number
  /** Whether breakeven has been triggered. */
  breakevenTriggered: boolean
  /** Whether trailing stop is activated. */
  trailingActivated: boolean
  /** Which partial close rules (by index) have been executed. */
  firedPartialCloseIndices: Set<number>
  /** Trade open time (epoch ms). */
  openedAt: number
  /** Current stop loss price from OANDA. */
  currentSL: number | null
  /** Current take profit price from OANDA. */
  currentTP: number | null
  /** Rolling exponential moving average of spread (in pips). Updated per tick. */
  emaSpreadPips: number | null
  /** Epoch ms of last avgSpread flush to DB. */
  lastSpreadFlushAt: number
}

type BroadcastFn = (type: string, data: unknown) => void

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum milliseconds between modifyTradeSLTP calls per trade. */
const DEBOUNCE_MS = 30_000

/** EMA alpha for rolling spread average (≈ last 30 ticks weighted). */
const SPREAD_EMA_ALPHA = 0.1

/** Minimum ms between DB flushes of the rolling avgSpread per trade. */
const SPREAD_FLUSH_INTERVAL_MS = 60_000

/** Session multipliers for pip-based thresholds. */
const SESSION_MULTIPLIERS: Record<string, number> = {
  primary: 1.0,
  overlap: 0.8,
  off: 1.5,
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class ManagementEngine {
  private tradeSyncer: TradeSyncerLike | null = null
  private readonly broadcast: BroadcastFn
  private readonly positionManager: PositionManager

  /** In-memory state per active SmartFlow trade, keyed by smartFlowTradeId. */
  private readonly states = new Map<string, SmartFlowTradeState>()

  /** In-memory state per waiting smart entry, keyed by smartFlowTradeId. */
  private readonly waitingEntries = new Map<string, SmartFlowWaitingEntryState>()

  /** Callback when a smart entry condition is met. Set by SmartFlowManager. */
  onEntryTriggered: ((configId: string, smartFlowTradeId: string) => void) | null = null

  /** Cached ATR values per instrument, set by parent SmartFlowManager. */
  private readonly atrMap = new Map<string, number>()

  /** Cached configs per configId, refreshed on load. */
  private readonly configCache = new Map<string, SmartFlowConfigData>()

  constructor(positionManager: PositionManager, broadcast: BroadcastFn) {
    this.positionManager = positionManager
    this.broadcast = broadcast
  }

  // ─── Late binding ────────────────────────────────────────────────────────

  /** Set the trade syncer reference (late-bound after construction). */
  setTradeSyncer(syncer: TradeSyncerLike): void {
    this.tradeSyncer = syncer
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Load active SmartFlow trades from DB to recover state after crash.
   * Also caches configs for each active trade.
   */
  async start(): Promise<void> {
    try {
      const { getActiveSmartFlowTrades, getSmartFlowConfig } = await import("@fxflow/db")
      const trades = await getActiveSmartFlowTrades()

      for (const trade of trades) {
        if (!trade.sourceTradeId || !trade.instrument || !trade.direction) continue

        // Load config for this trade
        const config = await getSmartFlowConfig(trade.configId)
        if (config) {
          this.configCache.set(config.id, config)
        }

        // Find the OANDA trade data from position manager for current units/SL/TP
        const positions = this.positionManager.getPositions()
        const oandaTrade = positions.open.find((t) => t.sourceTradeId === trade.sourceTradeId)

        this.states.set(trade.id, {
          smartFlowTradeId: trade.id,
          configId: trade.configId,
          tradeId: trade.tradeId,
          sourceTradeId: trade.sourceTradeId,
          instrument: trade.instrument,
          direction: trade.direction as "long" | "short",
          entryPrice: trade.entryPrice ?? oandaTrade?.entryPrice ?? 0,
          currentUnits: oandaTrade?.currentUnits ?? 0,
          lastModifyAt: 0,
          breakevenTriggered: trade.breakevenTriggered,
          trailingActivated: trade.trailingActivated,
          firedPartialCloseIndices: this.recoverFiredPartialCloses(trade),
          openedAt: new Date(trade.createdAt).getTime(),
          currentSL: oandaTrade?.stopLoss ?? null,
          currentTP: oandaTrade?.takeProfit ?? null,
          emaSpreadPips: null,
          lastSpreadFlushAt: 0,
        })
      }

      // Also load waiting entries
      for (const trade of trades) {
        if (trade.status !== "waiting_entry" || !trade.instrument || !trade.direction) continue
        const waitingConfig = await getSmartFlowConfig(trade.configId)
        if (waitingConfig) {
          this.configCache.set(waitingConfig.id, waitingConfig)
          this.waitingEntries.set(trade.id, {
            smartFlowTradeId: trade.id,
            configId: waitingConfig.id,
            instrument: waitingConfig.instrument,
            direction: waitingConfig.direction as "long" | "short",
            entryConditions: waitingConfig.entryConditions ?? [],
            entryPrice: waitingConfig.entryPrice ?? null,
            entryExpireHours: waitingConfig.entryExpireHours ?? null,
            createdAt: new Date(trade.createdAt).getTime(),
            lastProximityEmitAt: 0,
          })
        }
      }

      console.log(
        `[smart-flow-engine] Loaded ${this.states.size} active trade(s), ${this.waitingEntries.size} waiting entr(ies)`,
      )
    } catch (err) {
      console.error("[smart-flow-engine] Failed to load state from DB:", (err as Error).message)
    }
  }

  /**
   * Bulk-load active trades from DB for crash recovery.
   * Called by SmartFlowManager during startup.
   */
  loadActiveTrades(trades: SmartFlowTradeData[]): void {
    for (const trade of trades) {
      if (!trade.sourceTradeId || !trade.instrument || !trade.direction) continue
      const _config = this.configCache.get(trade.configId)
      const positions = this.positionManager.getPositions()
      const oandaTrade = positions.open.find((t) => t.sourceTradeId === trade.sourceTradeId)

      this.states.set(trade.id, {
        smartFlowTradeId: trade.id,
        configId: trade.configId,
        tradeId: trade.tradeId,
        sourceTradeId: trade.sourceTradeId,
        instrument: trade.instrument,
        direction: trade.direction as "long" | "short",
        entryPrice: trade.entryPrice ?? oandaTrade?.entryPrice ?? 0,
        currentUnits: oandaTrade?.currentUnits ?? 0,
        lastModifyAt: 0,
        breakevenTriggered: trade.breakevenTriggered,
        trailingActivated: trade.trailingActivated,
        firedPartialCloseIndices: this.recoverFiredPartialCloses(trade),
        openedAt: new Date(trade.createdAt).getTime(),
        currentSL: oandaTrade?.stopLoss ?? null,
        currentTP: oandaTrade?.takeProfit ?? null,
        emaSpreadPips: null,
        lastSpreadFlushAt: 0,
      })
    }

    // Also load waiting entries from the cached config
    for (const trade of trades) {
      if (trade.status !== "waiting_entry" || !trade.instrument || !trade.direction) continue
      const config = this.configCache.get(trade.configId)
      if (!config) continue
      this.waitingEntries.set(trade.id, {
        smartFlowTradeId: trade.id,
        configId: config.id,
        instrument: config.instrument,
        direction: config.direction as "long" | "short",
        entryConditions: config.entryConditions ?? [],
        entryPrice: config.entryPrice ?? null,
        entryExpireHours: config.entryExpireHours ?? null,
        createdAt: new Date(trade.createdAt).getTime(),
        lastProximityEmitAt: 0,
      })
    }
  }

  /**
   * Register a new SmartFlow trade for tick-by-tick management.
   */
  addTrade(trade: SmartFlowTradeData, config: SmartFlowConfigData): void {
    if (!trade.sourceTradeId || !trade.instrument || !trade.direction) return

    this.configCache.set(config.id, config)

    const positions = this.positionManager.getPositions()
    const oandaTrade = positions.open.find((t) => t.sourceTradeId === trade.sourceTradeId)

    this.states.set(trade.id, {
      smartFlowTradeId: trade.id,
      configId: trade.configId,
      tradeId: trade.tradeId,
      sourceTradeId: trade.sourceTradeId,
      instrument: trade.instrument,
      direction: trade.direction as "long" | "short",
      entryPrice: trade.entryPrice ?? oandaTrade?.entryPrice ?? 0,
      currentUnits: oandaTrade?.currentUnits ?? 0,
      lastModifyAt: 0,
      breakevenTriggered: trade.breakevenTriggered,
      trailingActivated: trade.trailingActivated,
      firedPartialCloseIndices: this.recoverFiredPartialCloses(trade),
      openedAt: new Date(trade.createdAt).getTime(),
      currentSL: oandaTrade?.stopLoss ?? null,
      currentTP: oandaTrade?.takeProfit ?? null,
      emaSpreadPips: null,
      lastSpreadFlushAt: 0,
    })
  }

  /** Remove a trade from tick management (e.g. on close). */
  removeTrade(smartFlowTradeId: string): void {
    this.states.delete(smartFlowTradeId)
  }

  /** Register a new smart entry for condition evaluation. */
  addWaitingEntry(trade: SmartFlowTradeData, config: SmartFlowConfigData): void {
    if (!config.instrument || !config.direction) return
    this.configCache.set(config.id, config)
    this.waitingEntries.set(trade.id, {
      smartFlowTradeId: trade.id,
      configId: config.id,
      instrument: config.instrument,
      direction: config.direction as "long" | "short",
      entryConditions: config.entryConditions ?? [],
      entryPrice: config.entryPrice ?? null,
      entryExpireHours: config.entryExpireHours ?? null,
      createdAt: new Date(trade.createdAt).getTime(),
      lastProximityEmitAt: 0,
    })
  }

  /** Remove a waiting entry (e.g. on trigger or expiry). */
  removeWaitingEntry(smartFlowTradeId: string): void {
    this.waitingEntries.delete(smartFlowTradeId)
  }

  /** Update cached config (e.g. when user edits settings). */
  updateConfig(config: SmartFlowConfigData): void {
    this.configCache.set(config.id, config)
  }

  /** Update OANDA position data for a managed trade (units, SL, TP). */
  updatePositionData(
    smartFlowTradeId: string,
    currentUnits: number,
    currentSL: number | null,
    currentTP: number | null,
  ): void {
    const state = this.states.get(smartFlowTradeId)
    if (state) {
      state.currentUnits = currentUnits
      state.currentSL = currentSL
      state.currentTP = currentTP
    }
  }

  /** Called by parent SmartFlowManager when ATR is recalculated. */
  updateAtr(instrument: string, atr: number): void {
    this.atrMap.set(instrument, atr)
  }

  /** Get the number of actively managed trades. */
  get activeCount(): number {
    return this.states.size
  }

  // ─── Core tick evaluation ────────────────────────────────────────────────

  /**
   * Evaluate all management rules for SmartFlow trades on the given instrument.
   * Called on every price tick by the parent manager.
   */
  async evaluateTick(instrument: string, bid: number, ask: number): Promise<void> {
    if (!this.tradeSyncer) return

    await this.evaluateWaitingEntries(instrument, bid, ask)

    const atr = this.atrMap.get(instrument)
    if (!atr || atr <= 0) return

    const pipSize = getPipSize(instrument)
    const sessionMultiplier = this.getSessionMultiplier(instrument)

    // Current-tick spread in pips. Shared across all trades on this instrument.
    const spreadPips = Math.max(0, (ask - bid) / pipSize)
    const now = Date.now()

    for (const state of this.states.values()) {
      if (state.instrument !== instrument) continue
      if (state.currentUnits <= 0) continue

      const config = this.configCache.get(state.configId)
      if (!config) continue

      // Rolling exponential moving average of spread. Flushed to DB at most
      // once per SPREAD_FLUSH_INTERVAL_MS per trade to keep write load low.
      state.emaSpreadPips =
        state.emaSpreadPips == null
          ? spreadPips
          : SPREAD_EMA_ALPHA * spreadPips + (1 - SPREAD_EMA_ALPHA) * state.emaSpreadPips
      if (now - state.lastSpreadFlushAt >= SPREAD_FLUSH_INTERVAL_MS) {
        state.lastSpreadFlushAt = now
        const flushValue = state.emaSpreadPips
        void import("@fxflow/db")
          .then(({ updateSmartFlowTrade }) =>
            updateSmartFlowTrade(state.smartFlowTradeId, { avgSpread: flushValue }),
          )
          .catch((err) =>
            console.warn(
              `[smart-flow-engine] avgSpread flush failed for ${state.smartFlowTradeId}:`,
              (err as Error).message,
            ),
          )
      }

      const currentPrice = state.direction === "long" ? bid : ask
      const profitPips = this.computeProfitPips(state, currentPrice, pipSize)

      try {
        // 1. Safety Net Check — close actions short-circuit
        const safetyClosed = await this.checkSafetyNets(
          state,
          config,
          profitPips,
          pipSize,
          sessionMultiplier,
        )
        if (safetyClosed) continue

        // 2. Take Profit Check (trend_rider fallback when TP removed)
        // OANDA handles TP normally; only check if TP was removed (e.g. trend_rider preset)
        // No action here — TP is on OANDA side

        // 3. Breakeven Check
        await this.checkBreakeven(state, config, profitPips, atr, pipSize, sessionMultiplier)

        // 4. Trailing Stop Check
        await this.checkTrailingStop(
          state,
          config,
          currentPrice,
          profitPips,
          atr,
          pipSize,
          sessionMultiplier,
        )

        // 5. Partial Close Check
        await this.checkPartialCloses(state, config, profitPips, atr, sessionMultiplier)
      } catch (err) {
        console.error(
          `[smart-flow-engine] Tick evaluation error for ${state.smartFlowTradeId} (${instrument}):`,
          (err as Error).message,
        )
      }
    }
  }

  // ─── Rule 1: Safety Nets ─────────────────────────────────────────────────

  private async checkSafetyNets(
    state: SmartFlowTradeState,
    config: SmartFlowConfigData,
    profitPips: number,
    pipSize: number,
    sessionMultiplier: number,
  ): Promise<boolean> {
    // Max drawdown (pips)
    if (config.maxDrawdownPips != null && config.maxDrawdownPips > 0) {
      const adjustedMax = config.maxDrawdownPips * sessionMultiplier
      if (profitPips <= -adjustedMax) {
        await this.closeTradeWithSafetyNet(state, "max_drawdown", "safety_net_max_drawdown")
        return true
      }
    }

    // Max hold time
    if (config.maxHoldHours != null && config.maxHoldHours > 0) {
      const durationMs = Date.now() - state.openedAt
      const durationHours = durationMs / 3_600_000
      if (durationHours >= config.maxHoldHours) {
        await this.closeTradeWithSafetyNet(state, "max_hold", "safety_net_max_hold")
        return true
      }
    }

    // Max financing
    if (config.maxFinancingUsd != null && config.maxFinancingUsd > 0) {
      // financingAccumulated is tracked on the SmartFlowTrade record
      // We need a fresh read — but to avoid blocking ticks, use a cached approach.
      // The parent SmartFlowManager should periodically update financing on the state.
      // For now, we read from the OANDA trade data via position manager.
      const positions = this.positionManager.getPositions()
      const oandaTrade = positions.open.find((t) => t.sourceTradeId === state.sourceTradeId)
      const financing = Math.abs(oandaTrade?.financing ?? 0)
      if (financing >= config.maxFinancingUsd) {
        await this.closeTradeWithSafetyNet(state, "max_financing", "safety_net_max_financing")
        return true
      }
    }

    return false
  }

  private async closeTradeWithSafetyNet(
    state: SmartFlowTradeState,
    safetyNet: "max_drawdown" | "max_hold" | "max_financing",
    logAction: string,
  ): Promise<void> {
    if (!this.tradeSyncer) return

    console.log(
      `[smart-flow-engine] Safety net triggered: ${safetyNet} for trade ${state.sourceTradeId} (${state.instrument})`,
    )

    emitActivity("safety_net_triggered", `Safety net (${safetyNet}) on ${state.instrument}`, {
      instrument: state.instrument,
      tradeId: state.tradeId ?? undefined,
      configId: state.configId,
      detail: `Closed trade ${state.sourceTradeId} — ${safetyNet}`,
      severity: "warning",
    })

    try {
      await this.tradeSyncer.closeTrade(
        state.sourceTradeId,
        undefined,
        `SmartFlow safety net: ${safetyNet}`,
        {
          closedBy: "smart_flow",
          closedByLabel: "SmartFlow",
          closedByDetail: `Safety net: ${safetyNet}`,
        },
      )
    } catch (err) {
      console.error(
        `[smart-flow-engine] Failed to close trade ${state.sourceTradeId} (${safetyNet}):`,
        (err as Error).message,
      )
      return
    }

    // Fire-and-forget DB updates
    this.logManagementEntry(state.smartFlowTradeId, {
      at: new Date().toISOString(),
      action: logAction,
      source: "rule",
      detail: `Safety net triggered: ${safetyNet}`,
    })

    void import("@fxflow/db")
      .then(({ closeSmartFlowTrade }) => closeSmartFlowTrade(state.smartFlowTradeId, safetyNet))
      .catch((err) => console.error("[smart-flow-engine] DB close error:", (err as Error).message))

    this.broadcastTradeUpdate(state, logAction, "safety_net", `Safety net: ${safetyNet}`)
    this.states.delete(state.smartFlowTradeId)
  }

  // ─── Rule 3: Breakeven ───────────────────────────────────────────────────

  private async checkBreakeven(
    state: SmartFlowTradeState,
    config: SmartFlowConfigData,
    profitPips: number,
    atr: number,
    pipSize: number,
    sessionMultiplier: number,
  ): Promise<void> {
    if (!config.breakevenEnabled) return
    if (state.breakevenTriggered) return
    if (!this.tradeSyncer) return
    if (!this.canModify(state)) return

    const thresholdPips = ((config.breakevenAtrMultiple * atr) / pipSize) * sessionMultiplier
    if (profitPips < thresholdPips) return

    // Calculate new SL at entry + buffer
    const bufferPrice = config.breakevenBufferPips * pipSize
    const newSL =
      state.direction === "long" ? state.entryPrice + bufferPrice : state.entryPrice - bufferPrice

    // Ensure new SL is better than current SL (ratchet)
    if (!this.isBetterSL(state, newSL)) return

    try {
      await this.tradeSyncer.modifyTradeSLTP(state.sourceTradeId, newSL, undefined)
      state.lastModifyAt = Date.now()
      state.breakevenTriggered = true
      state.currentSL = newSL

      console.log(
        `[smart-flow-engine] Breakeven set for ${state.sourceTradeId}: SL → ${newSL} (${state.instrument})`,
      )

      emitActivity("breakeven_set", `Breakeven set on ${state.instrument} at ${newSL}`, {
        instrument: state.instrument,
        tradeId: state.tradeId ?? undefined,
        configId: state.configId,
        severity: "success",
      })

      // Fire-and-forget DB updates
      void import("@fxflow/db")
        .then(({ updateSmartFlowTrade }) =>
          updateSmartFlowTrade(state.smartFlowTradeId, {
            breakevenTriggered: true,
            currentPhase: "breakeven" as SmartFlowPhase,
          }),
        )
        .catch((err) =>
          console.error("[smart-flow-engine] DB breakeven update error:", (err as Error).message),
        )

      this.logManagementEntry(state.smartFlowTradeId, {
        at: new Date().toISOString(),
        action: "breakeven_set",
        source: "rule",
        detail: `Moved SL to breakeven + ${config.breakevenBufferPips} pip buffer at ${newSL}`,
      })

      this.broadcastTradeUpdate(
        state,
        "breakeven_set",
        "breakeven",
        "Moved SL to breakeven + buffer",
      )
    } catch (err) {
      console.error(
        `[smart-flow-engine] Failed to set breakeven for ${state.sourceTradeId}:`,
        (err as Error).message,
      )
    }
  }

  // ─── Rule 4: Trailing Stop ───────────────────────────────────────────────

  private async checkTrailingStop(
    state: SmartFlowTradeState,
    config: SmartFlowConfigData,
    currentPrice: number,
    profitPips: number,
    atr: number,
    pipSize: number,
    sessionMultiplier: number,
  ): Promise<void> {
    if (!config.trailingEnabled) return
    if (!this.tradeSyncer) return
    if (!this.canModify(state)) return

    // Check activation threshold
    const activationPips = ((config.trailingActivationAtr * atr) / pipSize) * sessionMultiplier
    if (!state.trailingActivated) {
      if (profitPips >= activationPips) {
        state.trailingActivated = true

        // Fire-and-forget DB update
        void import("@fxflow/db")
          .then(({ updateSmartFlowTrade }) =>
            updateSmartFlowTrade(state.smartFlowTradeId, {
              trailingActivated: true,
              currentPhase: "trailing" as SmartFlowPhase,
            }),
          )
          .catch((err) =>
            console.error(
              "[smart-flow-engine] DB trailing activate error:",
              (err as Error).message,
            ),
          )

        emitActivity(
          "trailing_activated",
          `Trailing stop activated on ${state.instrument} at ${profitPips.toFixed(1)} pips`,
          {
            instrument: state.instrument,
            tradeId: state.tradeId ?? undefined,
            configId: state.configId,
            severity: "success",
          },
        )

        this.logManagementEntry(state.smartFlowTradeId, {
          at: new Date().toISOString(),
          action: "trailing_activated",
          source: "rule",
          detail: `Trailing stop activated at ${profitPips.toFixed(1)} pips profit`,
        })

        this.broadcastTradeUpdate(
          state,
          "trailing_activated",
          "trailing",
          "Trailing stop activated",
        )
      } else {
        return // Not yet activated
      }
    }

    // Calculate trailing SL
    const trailDistance = config.trailingAtrMultiple * atr * sessionMultiplier
    const trailSL =
      state.direction === "long" ? currentPrice - trailDistance : currentPrice + trailDistance

    // Round to pip precision
    const roundedTrailSL = Math.round(trailSL / pipSize) * pipSize

    // Only ratchet — never widen the stop
    if (!this.isBetterSL(state, roundedTrailSL)) return

    try {
      await this.tradeSyncer.modifyTradeSLTP(state.sourceTradeId, roundedTrailSL, undefined)
      state.lastModifyAt = Date.now()
      state.currentSL = roundedTrailSL

      emitActivity(
        "trailing_moved",
        `Trailing SL moved to ${roundedTrailSL} on ${state.instrument}`,
        {
          instrument: state.instrument,
          tradeId: state.tradeId ?? undefined,
          configId: state.configId,
          severity: "info",
        },
      )

      this.logManagementEntry(state.smartFlowTradeId, {
        at: new Date().toISOString(),
        action: "trailing_moved",
        source: "rule",
        detail: `Trailing SL moved to ${roundedTrailSL}`,
      })
    } catch (err) {
      console.error(
        `[smart-flow-engine] Failed to trail SL for ${state.sourceTradeId}:`,
        (err as Error).message,
      )
    }
  }

  // ─── Rule 5: Partial Closes ──────────────────────────────────────────────

  private async checkPartialCloses(
    state: SmartFlowTradeState,
    config: SmartFlowConfigData,
    profitPips: number,
    atr: number,
    sessionMultiplier: number,
  ): Promise<void> {
    if (!this.tradeSyncer) return
    if (!config.partialCloseRules || config.partialCloseRules.length === 0) return

    const pipSize = getPipSize(state.instrument)

    for (let i = 0; i < config.partialCloseRules.length; i++) {
      if (state.firedPartialCloseIndices.has(i)) continue

      const rule = config.partialCloseRules[i] as SmartFlowPartialCloseRule
      const thresholdPips = ((rule.atAtrMultiple * atr) / pipSize) * sessionMultiplier

      if (profitPips < thresholdPips) continue

      // Calculate units to close
      const unitsToClose = Math.floor(state.currentUnits * (rule.closePercent / 100))
      if (unitsToClose <= 0) continue

      try {
        await this.tradeSyncer.closeTrade(
          state.sourceTradeId,
          unitsToClose,
          `SmartFlow partial close (${rule.closePercent}% at ${rule.atAtrMultiple}x ATR)`,
          {
            closedBy: "smart_flow",
            closedByLabel: "SmartFlow",
            closedByDetail: `Partial close (${rule.closePercent}% at ${rule.atAtrMultiple}x ATR)`,
          },
        )

        state.firedPartialCloseIndices.add(i)
        state.currentUnits -= unitsToClose

        console.log(
          `[smart-flow-engine] Partial close ${rule.closePercent}% (${unitsToClose} units) for ${state.sourceTradeId} at ${profitPips.toFixed(1)} pips`,
        )

        emitActivity(
          "partial_close",
          `Partial close ${rule.closePercent}% on ${state.instrument} at ${profitPips.toFixed(1)} pips`,
          {
            instrument: state.instrument,
            tradeId: state.tradeId ?? undefined,
            configId: state.configId,
            detail: `Closed ${unitsToClose} units (${rule.closePercent}% at ${rule.atAtrMultiple}x ATR)`,
            severity: "success",
          },
        )

        // Fire-and-forget DB updates
        const entry: SmartFlowPartialCloseEntry = {
          at: new Date().toISOString(),
          atrMultiple: rule.atAtrMultiple,
          percent: rule.closePercent,
          units: unitsToClose,
          pips: Math.round(profitPips * 10) / 10,
          pnl: 0,
        }

        void import("@fxflow/db")
          .then(({ appendPartialCloseLog }) => appendPartialCloseLog(state.smartFlowTradeId, entry))
          .catch((err) =>
            console.error(
              "[smart-flow-engine] DB partial close log error:",
              (err as Error).message,
            ),
          )

        this.logManagementEntry(state.smartFlowTradeId, {
          at: new Date().toISOString(),
          action: "partial_close",
          source: "rule",
          detail: `Closed ${rule.closePercent}% (${unitsToClose} units) at ${profitPips.toFixed(1)} pips profit (${rule.atAtrMultiple}x ATR)`,
        })

        this.broadcastTradeUpdate(
          state,
          "partial_close",
          "partial",
          `Partial close: ${rule.closePercent}% at ${rule.atAtrMultiple}x ATR`,
        )
      } catch (err) {
        console.error(
          `[smart-flow-engine] Partial close failed for ${state.sourceTradeId}:`,
          (err as Error).message,
        )
      }
    }
  }

  // ─── Waiting Entry Evaluation ────────────────────────────────────────────

  /** Evaluate entry conditions for waiting smart entries. */
  private async evaluateWaitingEntries(
    instrument: string,
    bid: number,
    ask: number,
  ): Promise<void> {
    for (const entry of this.waitingEntries.values()) {
      if (entry.instrument !== instrument) continue

      const config = this.configCache.get(entry.configId)
      if (!config) continue

      // Check expiry
      if (entry.entryExpireHours != null && entry.entryExpireHours > 0) {
        const elapsedHours = (Date.now() - entry.createdAt) / 3_600_000
        if (elapsedHours >= entry.entryExpireHours) {
          emitActivity(
            "entry_expired",
            `Smart entry expired for ${instrument.replace("_", "/")} — waited ${Math.round(elapsedHours)} hours`,
            {
              instrument,
              severity: "warning",
              configId: entry.configId,
              tradeId: entry.smartFlowTradeId,
            },
          )
          void import("@fxflow/db")
            .then(({ closeSmartFlowTrade }) => closeSmartFlowTrade(entry.smartFlowTradeId))
            .catch((err) =>
              console.error("[smart-flow-engine] DB expire error:", (err as Error).message),
            )
          this.waitingEntries.delete(entry.smartFlowTradeId)
          continue
        }
      }

      // Buying at ask, selling at bid
      const currentPrice = entry.direction === "long" ? ask : bid

      // Check price_level condition (primary smart entry condition)
      if (entry.entryPrice != null && entry.entryPrice > 0) {
        const pip = getPipSize(instrument)
        const distancePips = Math.abs(currentPrice - entry.entryPrice) / pip

        // Trigger when within 2 pips
        if (distancePips <= 2) {
          this.onEntryTriggered?.(entry.configId, entry.smartFlowTradeId)
          this.waitingEntries.delete(entry.smartFlowTradeId)
          continue
        }

        // Emit proximity updates (max once per 30s) when within 50 pips
        if (Date.now() - entry.lastProximityEmitAt > 30_000 && distancePips < 50) {
          entry.lastProximityEmitAt = Date.now()
          const formattedPair = instrument.replace("_", "/")
          const decimals = pip < 0.01 ? 5 : 3
          emitActivity(
            "entry_watching" as SmartFlowActivityType,
            `${formattedPair} at ${currentPrice.toFixed(decimals)} — ${distancePips.toFixed(0)} pips from entry target ${entry.entryPrice.toFixed(decimals)}`,
            {
              instrument,
              configId: entry.configId,
              tradeId: entry.smartFlowTradeId,
            },
          )
        }
      }

      // Check additional entry conditions from config
      if (entry.entryConditions.length > 0) {
        for (const condition of entry.entryConditions) {
          if (this.evaluateEntryCondition(condition, currentPrice, instrument)) {
            this.onEntryTriggered?.(entry.configId, entry.smartFlowTradeId)
            this.waitingEntries.delete(entry.smartFlowTradeId)
            break
          }
        }
      }
    }
  }

  /** Evaluate a single entry condition against the current price. */
  private evaluateEntryCondition(
    condition: SmartFlowEntryCondition,
    currentPrice: number,
    instrument: string,
  ): boolean {
    switch (condition.type) {
      case "price_level": {
        const target = condition.value.price as number | undefined
        const pip = getPipSize(instrument)
        if (target != null) return Math.abs(currentPrice - target) / pip <= 2
        return false
      }
      case "zone_proximity": {
        const upper = condition.value.upper as number | undefined
        const lower = condition.value.lower as number | undefined
        if (upper != null && lower != null) return currentPrice >= lower && currentPrice <= upper
        return false
      }
      case "rsi_threshold":
        // RSI not available on tick — skip (would need indicator data)
        return false
      case "momentum":
        // Momentum not available on tick — skip
        return false
      default:
        return false
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Compute profit in pips for the current direction. */
  private computeProfitPips(
    state: SmartFlowTradeState,
    currentPrice: number,
    pipSize: number,
  ): number {
    const distance =
      state.direction === "long" ? currentPrice - state.entryPrice : state.entryPrice - currentPrice
    return distance / pipSize
  }

  /** Check debounce — returns true if enough time has passed since last modify. */
  private canModify(state: SmartFlowTradeState): boolean {
    return Date.now() - state.lastModifyAt >= DEBOUNCE_MS
  }

  /**
   * Returns true if the proposed SL is strictly better (tighter / more favorable)
   * than the current SL. For longs, "better" = higher SL. For shorts, "better" = lower SL.
   * If there is no current SL, any value is considered better.
   */
  private isBetterSL(state: SmartFlowTradeState, proposedSL: number): boolean {
    if (state.currentSL == null) return true
    return state.direction === "long" ? proposedSL > state.currentSL : proposedSL < state.currentSL
  }

  /**
   * Determine the session-based threshold multiplier for an instrument.
   * Primary session = 1.0, overlap = 0.8, off-session = 1.5.
   */
  private getSessionMultiplier(instrument: string): number {
    const sessionInfo = getCurrentSession()
    const session = sessionInfo.session
    const bestPairs = sessionInfo.bestPairs

    // Overlap sessions get tighter thresholds
    if (session === "london_ny_overlap") {
      return SESSION_MULTIPLIERS.overlap ?? 0.8
    }

    // Off-session = wider thresholds (less noise sensitivity)
    if (session === "off_session") {
      return SESSION_MULTIPLIERS.off ?? 1.5
    }

    // Check if this instrument is in its primary session
    if (bestPairs.includes(instrument)) {
      return SESSION_MULTIPLIERS.primary ?? 1.0
    }

    // Active session but not a primary pair — use default
    return 1.0
  }

  /**
   * Recover which partial close rules have already fired from the trade's log.
   * Matches by ATR multiple to reconstruct the fired index set.
   */
  private recoverFiredPartialCloses(trade: SmartFlowTradeData): Set<number> {
    const fired = new Set<number>()
    if (!trade.partialCloseLog || trade.partialCloseLog.length === 0) return fired

    // We need the config to know the rules — load from cache or skip
    const config = this.configCache.get(trade.configId)
    if (!config?.partialCloseRules) return fired

    for (const entry of trade.partialCloseLog) {
      const idx = config.partialCloseRules.findIndex((r) => r.atAtrMultiple === entry.atrMultiple)
      if (idx >= 0) fired.add(idx)
    }

    return fired
  }

  /** Fire-and-forget management log append. */
  private logManagementEntry(smartFlowTradeId: string, entry: SmartFlowManagementEntry): void {
    void import("@fxflow/db")
      .then(({ appendManagementLog }) => appendManagementLog(smartFlowTradeId, entry))
      .catch((err) =>
        console.error("[smart-flow-engine] DB management log error:", (err as Error).message),
      )
  }

  /** Broadcast a SmartFlow trade update via WebSocket. */
  private broadcastTradeUpdate(
    state: SmartFlowTradeState,
    action: string,
    phase: SmartFlowPhase,
    detail: string,
  ): void {
    const data: SmartFlowTradeUpdateData = {
      smartFlowTradeId: state.smartFlowTradeId,
      tradeId: state.tradeId,
      instrument: state.instrument,
      action,
      phase,
      detail,
    }
    this.broadcast("smart_flow_trade_update", data)
  }
}
