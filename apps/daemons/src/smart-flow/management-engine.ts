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
  SmartFlowManagementEntry,
  SmartFlowPartialCloseEntry,
  SmartFlowPartialCloseRule,
  SmartFlowTradeUpdateData,
  SmartFlowPhase,
} from "@fxflow/types"
import type { PositionManager } from "../positions/position-manager.js"
import { emitActivity } from "./activity-feed.js"

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Minimal trade syncer interface (late-bound via setter). */
interface TradeSyncerLike {
  modifyTradeSLTP(sourceTradeId: string, stopLoss?: number, takeProfit?: number): Promise<unknown>
  closeTrade(sourceTradeId: string, units?: number, reason?: string): Promise<void>
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
}

type BroadcastFn = (type: string, data: unknown) => void

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum milliseconds between modifyTradeSLTP calls per trade. */
const DEBOUNCE_MS = 30_000

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
        })
      }

      console.log(`[smart-flow-engine] Loaded ${this.states.size} active trade(s)`)
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
    })
  }

  /** Remove a trade from tick management (e.g. on close). */
  removeTrade(smartFlowTradeId: string): void {
    this.states.delete(smartFlowTradeId)
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

    const atr = this.atrMap.get(instrument)
    if (!atr || atr <= 0) return

    const pipSize = getPipSize(instrument)
    const sessionMultiplier = this.getSessionMultiplier(instrument)

    for (const state of this.states.values()) {
      if (state.instrument !== instrument) continue
      if (state.currentUnits <= 0) continue

      const config = this.configCache.get(state.configId)
      if (!config) continue

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
