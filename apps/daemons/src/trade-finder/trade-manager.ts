/**
 * Trade Finder Trade Manager — post-fill management for Trade Finder trades.
 *
 * Monitors open Trade Finder trades via price ticks and applies management rules:
 * - Breakeven: move SL to entry + buffer at 1:1 R:R
 * - Partial close: close a % of position at configurable R:R target
 * - Trailing stop: trail SL behind recent candle structure
 * - Time exit: close if no progress after N candles
 *
 * Follows the same late-binding pattern as ConditionMonitor and AiTraderScanner.
 */

import type {
  TradeFinderConfigData,
  TradeFinderSetupData,
  TradeFinderManagementAction,
  PositionPriceTick,
  AnyDaemonMessage,
  OpenTradeData,
  CloseContext,
} from "@fxflow/types"
import {
  getTradeFinderConfig,
  findSetupByResultSourceId,
  findPlacedSetupByInstrumentDirection,
  updateSetupManagement,
  appendTradeFinderManagementLog,
  getFilledSetups,
} from "@fxflow/db"
import { getPipSize, getDecimalPlaces, checkStructuralConfirmation } from "@fxflow/shared"
import type { ZoneCandle } from "@fxflow/types"
import { getTimeframeSetMap } from "@fxflow/types"

/** Callback types for late-binding */
export interface ModifyTradeSLTPFn {
  (
    sourceTradeId: string,
    stopLoss?: number | null,
    takeProfit?: number | null,
  ): Promise<{
    stopLoss: number | null
    takeProfit: number | null
  }>
}

export interface CloseTradeFn {
  (
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

export interface GetOpenTradesFn {
  (): OpenTradeData[]
}

export interface FetchCandlesFn {
  (instrument: string, timeframe: string, count: number): Promise<ZoneCandle[]>
}

/** Grace period after fill before management starts (prevents whipsaw) */
const FILL_GRACE_MS = 30_000

/** Minimum time between SL modifications for same trade */
const MODIFY_COOLDOWN_MS = 60_000

interface ManagedTrade {
  setup: TradeFinderSetupData
  sourceTradeId: string
  filledAt: number // timestamp
  lastModifiedAt: number
}

export class TradeFinderTradeManager {
  private managedTrades = new Map<string, ManagedTrade>() // sourceTradeId → state
  private modifyTradeFn: ModifyTradeSLTPFn | null = null
  private closeTradeFn: CloseTradeFn | null = null
  private getOpenTradesFn: GetOpenTradesFn | null = null
  private fetchCandlesFn: FetchCandlesFn | null = null
  private broadcast: (msg: AnyDaemonMessage) => void

  constructor(broadcast: (msg: AnyDaemonMessage) => void) {
    this.broadcast = broadcast
  }

  /** Late-bind trade modification callbacks after syncer is ready */
  setCallbacks(
    modifyTrade: ModifyTradeSLTPFn,
    closeTrade: CloseTradeFn,
    getOpenTrades: GetOpenTradesFn,
    fetchCandles?: FetchCandlesFn,
  ): void {
    this.modifyTradeFn = modifyTrade
    this.closeTradeFn = closeTrade
    this.getOpenTradesFn = getOpenTrades
    this.fetchCandlesFn = fetchCandles ?? null
  }

  /** Initialize by loading existing filled setups */
  async initialize(): Promise<void> {
    const filledSetups = await getFilledSetups()
    for (const setup of filledSetups) {
      if (setup.resultSourceId) {
        this.managedTrades.set(setup.resultSourceId, {
          setup,
          sourceTradeId: setup.resultSourceId,
          filledAt: setup.placedAt ? new Date(setup.placedAt).getTime() : Date.now(),
          lastModifiedAt: 0,
        })
      }
    }
    if (this.managedTrades.size > 0) {
      console.log(
        `[trade-finder-mgr] Loaded ${this.managedTrades.size} filled trades for management`,
      )
    }
  }

  /** Called when a Trade Finder order fills */
  async onOrderFilled(dbTradeId: string, oandaSourceTradeId: string): Promise<void> {
    // Primary: match by OANDA trade ID
    let setup = await findSetupByResultSourceId(oandaSourceTradeId)

    // Fallback: when LIMIT order fills, resultSourceId may still hold the old order ID.
    // Look up the DB trade to get instrument+direction and find matching setup.
    if (!setup) {
      try {
        const { db: prisma } = await import("@fxflow/db")
        const trade = await prisma.trade.findUnique({ where: { id: dbTradeId } })
        if (trade) {
          // Check recently-filled setups matching this instrument+direction
          setup = await findPlacedSetupByInstrumentDirection(trade.instrument, trade.direction)
          // Also check filled setups (scanner may have already transitioned it)
          if (!setup) setup = await findSetupByResultSourceId(oandaSourceTradeId)
        }
      } catch {
        /* best-effort fallback */
      }
    }

    if (!setup || (setup.status !== "filled" && setup.status !== "placed")) return

    this.managedTrades.set(oandaSourceTradeId, {
      setup,
      sourceTradeId: oandaSourceTradeId,
      filledAt: Date.now(),
      lastModifiedAt: 0,
    })
    console.log(`[trade-finder-mgr] Now managing: ${setup.instrument} ${setup.direction}`)
  }

  /** Called when a trade closes — stop managing it */
  onTradeClosed(sourceTradeId: string): void {
    if (this.managedTrades.delete(sourceTradeId)) {
      console.log(`[trade-finder-mgr] Trade closed, stopped managing: ${sourceTradeId}`)
    }
  }

  /** Process price tick for all managed trades */
  async onPriceTick(tick: PositionPriceTick): Promise<void> {
    if (!this.modifyTradeFn || !this.closeTradeFn || !this.getOpenTradesFn) return

    const config = await getTradeFinderConfig()
    const openTrades = this.getOpenTradesFn()
    const now = Date.now()

    for (const [sourceTradeId, managed] of this.managedTrades) {
      // Only process ticks for this instrument
      if (managed.setup.instrument !== tick.instrument) continue

      // Grace period after fill
      if (now - managed.filledAt < FILL_GRACE_MS) continue

      // Find the live trade
      const trade = openTrades.find((t) => t.sourceTradeId === sourceTradeId)
      if (!trade) {
        // Trade no longer open — will be cleaned up by onTradeClosed
        continue
      }

      const mid = (tick.bid + tick.ask) / 2
      await this.evaluateManagement(managed, trade, mid, config, now)
    }
  }

  /** Broadcast a management action event to connected clients */
  private broadcastManagementAction(
    setup: TradeFinderSetupData,
    action: TradeFinderManagementAction,
  ): void {
    this.broadcast({
      type: "trade_finder_management_action",
      timestamp: new Date().toISOString(),
      data: {
        setupId: setup.id,
        instrument: setup.instrument,
        direction: setup.direction,
        action,
      },
    })
  }

  /** Check if AI conditions are actively managing this trade */
  private async isAiManaged(config: TradeFinderConfigData, tradeId: string): Promise<boolean> {
    if (!config.aiManagedEnabled) return false
    try {
      const { listActiveConditions } = await import("@fxflow/db")
      const conditions = await listActiveConditions()
      return conditions.some(
        (c) => c.tradeId === tradeId && c.createdBy === "ai" && c.status === "active",
      )
    } catch {
      return false
    }
  }

  private async evaluateManagement(
    managed: ManagedTrade,
    trade: OpenTradeData,
    currentPrice: number,
    config: TradeFinderConfigData,
    now: number,
  ): Promise<void> {
    const { setup } = managed

    // AI management deferral: if AI conditions are actively managing this trade,
    // only intervene for emergency (5% position drawdown)
    const aiManaged = await this.isAiManaged(config, trade.id)
    if (aiManaged) {
      const pipSize = getPipSize(setup.instrument)
      const pnlPips =
        setup.direction === "long"
          ? (currentPrice - setup.entryPrice) / pipSize
          : (setup.entryPrice - currentPrice) / pipSize
      const drawdownPercent = setup.riskPips > 0 ? Math.abs(pnlPips / setup.riskPips) : 0

      // Only intervene if position is in severe drawdown (> 3x risk)
      if (pnlPips >= 0 || drawdownPercent < 3) {
        // AI is handling this trade — skip TF management
        if (!setup.managementLog.some((l) => l.action === "ai_handoff")) {
          await appendTradeFinderManagementLog(setup.id, {
            action: "ai_handoff",
            detail: "Deferring to AI condition management",
            timestamp: new Date().toISOString(),
          })
          this.broadcastManagementAction(setup, {
            action: "ai_handoff",
            detail: "Deferring to AI condition management",
            timestamp: new Date().toISOString(),
          })
        }
        return
      }
    }

    const pipSize = getPipSize(setup.instrument)
    const decimals = getDecimalPlaces(setup.instrument)

    // Calculate current P&L in pips
    const pnlPips =
      setup.direction === "long"
        ? (currentPrice - setup.entryPrice) / pipSize
        : (setup.entryPrice - currentPrice) / pipSize

    const rrAchieved = setup.riskPips > 0 ? pnlPips / setup.riskPips : 0

    // 1. Breakeven move — scale trigger by risk distance + structural confirmation
    //    Tight SL (< 15 pips): 1.5:1 R:R (more room to breathe)
    //    Normal SL (15-30 pips): 1.0:1 R:R (standard)
    //    Wide SL (30+ pips): 0.75:1 R:R (lock in faster)
    if (config.breakevenEnabled && !setup.breakevenMoved) {
      const beThreshold = setup.riskPips < 15 ? 1.5 : setup.riskPips > 30 ? 0.75 : 1.0
      if (rrAchieved >= beThreshold) {
        // Structural confirmation: require swing point before BE (unless > 2x risk in profit)
        if (rrAchieved < 2.0) {
          const structural = await this.checkStructural(managed)
          if (!structural) {
            // No structural confirmation yet — wait for next tick
            return
          }
        }
        await this.moveToBreakeven(managed, trade, decimals)
        return // One action per tick
      }
    }

    // 2. Partial close
    if (config.partialCloseEnabled && !setup.partialTaken && setup.breakevenMoved) {
      // "thirds" strategy: close 33% at 1:1, "standard": close at configured R:R
      const partialRR = config.partialExitStrategy === "thirds" ? 1.0 : config.partialCloseRR
      const partialPct = config.partialExitStrategy === "thirds" ? 33 : config.partialClosePercent
      if (rrAchieved >= partialRR) {
        await this.takePartialProfit(
          managed,
          trade,
          { ...config, partialClosePercent: partialPct },
          decimals,
        )
        return
      }
    }

    // 2b. Second partial for "thirds" strategy: close another 33% at 2:1, trail SL to 1:1
    if (
      config.partialCloseEnabled &&
      config.partialExitStrategy === "thirds" &&
      setup.partialTaken &&
      rrAchieved >= 2.0 &&
      now - managed.lastModifiedAt > MODIFY_COOLDOWN_MS
    ) {
      // Close another 33% of the ORIGINAL position (50% of remaining)
      const unitsToClose = Math.floor(trade.currentUnits * 0.5)
      if (unitsToClose > 0 && this.closeTradeFn) {
        try {
          await this.closeTradeFn(
            managed.sourceTradeId,
            unitsToClose,
            "Trade Finder thirds: 2nd partial at 2:1 R:R",
            {
              closedBy: "trade_finder",
              closedByLabel: "Trade Finder",
              closedByDetail: "Thirds strategy: 2nd partial at 2:1 R:R",
            },
          )
          // Move SL to 1:1 R:R level
          const oneRLevel =
            setup.direction === "long"
              ? setup.entryPrice + setup.riskPips * pipSize
              : setup.entryPrice - setup.riskPips * pipSize
          const roundedSL = parseFloat(oneRLevel.toFixed(decimals))
          if (this.modifyTradeFn) {
            await this.modifyTradeFn(managed.sourceTradeId, roundedSL, undefined)
          }
          managed.lastModifiedAt = Date.now()
          await appendTradeFinderManagementLog(setup.id, {
            action: "thirds_partial",
            detail: `2nd partial: ${unitsToClose} units, SL → ${roundedSL.toFixed(decimals)} (1R)`,
            newValue: roundedSL,
            timestamp: new Date().toISOString(),
          })
          console.log(
            `[trade-finder-mgr] THIRDS 2nd PARTIAL: ${setup.instrument} closed ${unitsToClose} units, SL → ${roundedSL.toFixed(decimals)} (1R)`,
          )
        } catch (err) {
          console.error(
            `[trade-finder-mgr] Thirds 2nd partial failed for ${setup.instrument}:`,
            err,
          )
        }
        return
      }
    }

    // 3. Trailing stop (after partial or after 2:1 if partials disabled)
    if (config.trailingStopEnabled) {
      const trailAfter = config.partialCloseEnabled ? setup.partialTaken : rrAchieved >= 2.0
      if (trailAfter && now - managed.lastModifiedAt > MODIFY_COOLDOWN_MS) {
        await this.updateTrailingStop(managed, trade, currentPrice, decimals)
      }
    }

    // 4. Time-based exit
    if (config.timeExitEnabled && rrAchieved < 0.5) {
      // Check how long the trade has been open in candle terms
      const holdMinutes = (now - managed.filledAt) / 60_000
      const candleMinutes = this.getCandleMinutes(setup.timeframeSet)
      const candlesHeld = holdMinutes / candleMinutes
      if (candlesHeld >= config.timeExitCandles) {
        await this.timeBasedExit(managed, trade, config.timeExitCandles)
        return
      }
    }
  }

  private async moveToBreakeven(
    managed: ManagedTrade,
    trade: OpenTradeData,
    decimals: number,
  ): Promise<void> {
    if (!this.modifyTradeFn) return

    const { setup } = managed
    const pipSize = getPipSize(setup.instrument)
    // Buffer: estimated spread (2 pips) + 1 pip margin to cover costs
    const buffer = pipSize * 3 + pipSize
    const newSL = setup.direction === "long" ? setup.entryPrice + buffer : setup.entryPrice - buffer
    const roundedSL = parseFloat(newSL.toFixed(decimals))

    // Don't move SL if it would be worse than current
    if (trade.stopLoss !== null) {
      if (setup.direction === "long" && roundedSL <= trade.stopLoss) return
      if (setup.direction === "short" && roundedSL >= trade.stopLoss) return
    }

    try {
      await this.modifyTradeFn(managed.sourceTradeId, roundedSL, undefined)
      managed.setup = { ...setup, breakevenMoved: true }
      managed.lastModifiedAt = Date.now()
      await updateSetupManagement(setup.id, { breakevenMoved: true })
      await appendTradeFinderManagementLog(setup.id, {
        action: "breakeven",
        detail: `SL moved to ${roundedSL.toFixed(decimals)}`,
        previousValue: trade.stopLoss ?? undefined,
        newValue: roundedSL,
        timestamp: new Date().toISOString(),
      })

      const beAction: TradeFinderManagementAction = {
        action: "breakeven",
        detail: `SL moved to ${roundedSL.toFixed(decimals)}`,
        previousValue: trade.stopLoss ?? undefined,
        newValue: roundedSL,
        timestamp: new Date().toISOString(),
      }
      console.log(
        `[trade-finder-mgr] BREAKEVEN: ${setup.instrument} SL → ${roundedSL.toFixed(decimals)}`,
      )
      this.broadcast({
        type: "trade_finder_setup_updated",
        timestamp: new Date().toISOString(),
        data: managed.setup,
      })
      this.broadcastManagementAction(setup, beAction)
    } catch (err) {
      console.error(`[trade-finder-mgr] Breakeven failed for ${setup.instrument}:`, err)
    }
  }

  private async takePartialProfit(
    managed: ManagedTrade,
    trade: OpenTradeData,
    config: TradeFinderConfigData,
    _decimals: number,
  ): Promise<void> {
    if (!this.closeTradeFn) return

    const { setup } = managed
    const unitsToClose = Math.floor(trade.currentUnits * (config.partialClosePercent / 100))
    if (unitsToClose <= 0) return

    try {
      await this.closeTradeFn(
        managed.sourceTradeId,
        unitsToClose,
        `Trade Finder partial profit at ${config.partialCloseRR}:1 R:R`,
        {
          closedBy: "trade_finder",
          closedByLabel: "Trade Finder",
          closedByDetail: `Partial profit at ${config.partialCloseRR}:1 R:R (${config.partialClosePercent}%)`,
        },
      )
      managed.setup = { ...setup, partialTaken: true }
      managed.lastModifiedAt = Date.now()
      await updateSetupManagement(setup.id, { partialTaken: true })
      await appendTradeFinderManagementLog(setup.id, {
        action: "partial_close",
        detail: `Closed ${unitsToClose} units (${config.partialClosePercent}%) at ${config.partialCloseRR}:1 R:R`,
        timestamp: new Date().toISOString(),
      })

      console.log(
        `[trade-finder-mgr] PARTIAL: ${setup.instrument} closed ${unitsToClose} units (${config.partialClosePercent}%)`,
      )
      this.broadcast({
        type: "trade_finder_setup_updated",
        timestamp: new Date().toISOString(),
        data: managed.setup,
      })
    } catch (err) {
      console.error(`[trade-finder-mgr] Partial close failed for ${setup.instrument}:`, err)
    }
  }

  private async updateTrailingStop(
    managed: ManagedTrade,
    trade: OpenTradeData,
    currentPrice: number,
    decimals: number,
  ): Promise<void> {
    if (!this.modifyTradeFn) return

    const { setup } = managed
    const pipSize = getPipSize(setup.instrument)

    // ATR-based trailing: fetch live ATR and use timeframe-appropriate multiplier
    const atr = await this.fetchATRForSetup(setup)
    const trailMultiplier = this.getTrailMultiplier(setup.timeframeSet)
    // ATR-based distance, with riskPips fallback and 10-pip minimum
    const trailDistance = atr
      ? Math.max(atr * trailMultiplier, pipSize * 10)
      : Math.max(setup.riskPips * pipSize * 0.5, pipSize * 10)

    let newSL: number
    if (setup.direction === "long") {
      newSL = currentPrice - trailDistance
    } else {
      newSL = currentPrice + trailDistance
    }
    const roundedSL = parseFloat(newSL.toFixed(decimals))

    // Only move SL in favorable direction
    if (trade.stopLoss !== null) {
      if (setup.direction === "long" && roundedSL <= trade.stopLoss) return
      if (setup.direction === "short" && roundedSL >= trade.stopLoss) return
    }

    try {
      await this.modifyTradeFn(managed.sourceTradeId, roundedSL, undefined)
      managed.lastModifiedAt = Date.now()
      await appendTradeFinderManagementLog(setup.id, {
        action: "trailing_update",
        detail: `Trailing SL → ${roundedSL.toFixed(decimals)}`,
        previousValue: trade.stopLoss ?? undefined,
        newValue: roundedSL,
        timestamp: new Date().toISOString(),
      })

      console.log(
        `[trade-finder-mgr] TRAIL: ${setup.instrument} SL → ${roundedSL.toFixed(decimals)}`,
      )
    } catch (err) {
      console.error(`[trade-finder-mgr] Trail SL failed for ${setup.instrument}:`, err)
    }
  }

  private async timeBasedExit(
    managed: ManagedTrade,
    _trade: OpenTradeData,
    maxCandles: number,
  ): Promise<void> {
    if (!this.closeTradeFn) return

    const { setup } = managed
    try {
      await this.closeTradeFn(
        managed.sourceTradeId,
        undefined, // Full close
        "Trade Finder time-based exit — no progress",
        {
          closedBy: "trade_finder",
          closedByLabel: "Trade Finder",
          closedByDetail: `Time exit after ${maxCandles} candles — no progress`,
        },
      )
      await appendTradeFinderManagementLog(setup.id, {
        action: "time_exit",
        detail: `Closed after ${maxCandles} candles — no progress`,
        timestamp: new Date().toISOString(),
      })
      this.managedTrades.delete(managed.sourceTradeId)

      console.log(`[trade-finder-mgr] TIME EXIT: ${setup.instrument} closed — no progress`)
    } catch (err) {
      console.error(`[trade-finder-mgr] Time exit failed for ${setup.instrument}:`, err)
    }
  }

  private getCandleMinutes(timeframeSet: string): number {
    // Standard speed: hourly→M15, daily→H1, weekly→H4, monthly→D
    const map: Record<string, number> = {
      hourly: 15, // LTF is M15 (standard)
      daily: 60, // LTF is H1 (standard)
      weekly: 240, // LTF is H4 (standard)
      monthly: 1440, // LTF is D (standard)
    }
    return map[timeframeSet] ?? 15
  }

  /** ATR trailing multiplier by timeframe (scalp=tight, swing=wide) */
  private getTrailMultiplier(timeframeSet: string): number {
    const map: Record<string, number> = {
      hourly: 1.0,
      daily: 1.5,
      weekly: 2.0,
      monthly: 2.5,
    }
    return map[timeframeSet] ?? 1.5
  }

  /** Fetch current ATR for a setup's LTF to use in adaptive trailing */
  private async fetchATRForSetup(setup: TradeFinderSetupData): Promise<number | null> {
    if (!this.fetchCandlesFn) return null
    try {
      const tfMap = getTimeframeSetMap("standard")
      const { ltf } = tfMap[setup.timeframeSet]
      const candles = await this.fetchCandlesFn(setup.instrument, ltf, 20)
      if (candles.length < 14) return null
      // Simple ATR calculation
      let sum = 0
      for (let i = candles.length - 14; i < candles.length; i++) {
        const c = candles[i]!
        const prev = candles[i - 1]!
        const tr = Math.max(
          c.high - c.low,
          Math.abs(c.high - prev.close),
          Math.abs(c.low - prev.close),
        )
        sum += tr
      }
      return sum / 14
    } catch {
      return null
    }
  }

  /** Check structural confirmation (swing point in trade direction) before breakeven */
  private async checkStructural(managed: ManagedTrade): Promise<boolean> {
    if (!this.fetchCandlesFn) return true // Fail open if no candle access
    const { setup } = managed
    try {
      const tfMap = getTimeframeSetMap("standard")
      const { ltf } = tfMap[setup.timeframeSet]
      const candles = await this.fetchCandlesFn(setup.instrument, ltf, 30)
      if (candles.length < 10) return false

      // Only use candles after fill
      const fillTime = managed.filledAt / 1000
      const postFillCandles = candles
        .filter((c) => c.time >= fillTime)
        .map((c) => ({ ...c, volume: 0 }))

      if (postFillCandles.length < 7) return false

      const dir = setup.direction as "long" | "short"
      const result = checkStructuralConfirmation(dir, setup.entryPrice, postFillCandles, 3)
      return result.confirmed
    } catch {
      // On error, allow breakeven (fail open to protect the trade)
      return true
    }
  }
}
