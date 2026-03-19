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
  PositionPriceTick,
  AnyDaemonMessage,
  OpenTradeData,
} from "@fxflow/types"
import {
  getTradeFinderConfig,
  findSetupByResultSourceId,
  findPlacedSetupByInstrumentDirection,
  updateSetupManagement,
  getFilledSetups,
} from "@fxflow/db"
import { getPipSize, getDecimalPlaces } from "@fxflow/shared"

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
  (sourceTradeId: string, units?: number, reason?: string): Promise<void>
}

export interface GetOpenTradesFn {
  (): OpenTradeData[]
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
  private broadcast: (msg: AnyDaemonMessage) => void

  constructor(broadcast: (msg: AnyDaemonMessage) => void) {
    this.broadcast = broadcast
  }

  /** Late-bind trade modification callbacks after syncer is ready */
  setCallbacks(
    modifyTrade: ModifyTradeSLTPFn,
    closeTrade: CloseTradeFn,
    getOpenTrades: GetOpenTradesFn,
  ): void {
    this.modifyTradeFn = modifyTrade
    this.closeTradeFn = closeTrade
    this.getOpenTradesFn = getOpenTrades
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

  private async evaluateManagement(
    managed: ManagedTrade,
    trade: OpenTradeData,
    currentPrice: number,
    config: TradeFinderConfigData,
    now: number,
  ): Promise<void> {
    const { setup } = managed
    const pipSize = getPipSize(setup.instrument)
    const decimals = getDecimalPlaces(setup.instrument)

    // Calculate current P&L in pips
    const pnlPips =
      setup.direction === "long"
        ? (currentPrice - setup.entryPrice) / pipSize
        : (setup.entryPrice - currentPrice) / pipSize

    const rrAchieved = setup.riskPips > 0 ? pnlPips / setup.riskPips : 0

    // 1. Breakeven move
    if (config.breakevenEnabled && !setup.breakevenMoved && rrAchieved >= 1.0) {
      await this.moveToBreakeven(managed, trade, decimals)
      return // One action per tick
    }

    // 2. Partial close
    if (
      config.partialCloseEnabled &&
      !setup.partialTaken &&
      setup.breakevenMoved &&
      rrAchieved >= config.partialCloseRR
    ) {
      await this.takePartialProfit(managed, trade, config, decimals)
      return
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
        await this.timeBasedExit(managed, trade)
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
    // Buffer: spread + small margin to prevent noise stop-outs
    const buffer = pipSize * 3
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

      console.log(
        `[trade-finder-mgr] BREAKEVEN: ${setup.instrument} SL → ${roundedSL.toFixed(decimals)}`,
      )
      this.broadcast({
        type: "trade_finder_setup_updated",
        timestamp: new Date().toISOString(),
        data: managed.setup,
      })
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
      )
      managed.setup = { ...setup, partialTaken: true }
      managed.lastModifiedAt = Date.now()
      await updateSetupManagement(setup.id, { partialTaken: true })

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
    // Trail behind current price by a minimum distance (ATR-like: use riskPips as proxy)
    const trailDistance = Math.max(setup.riskPips * pipSize * 0.5, pipSize * 10) // Min 10 pips

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

      console.log(
        `[trade-finder-mgr] TRAIL: ${setup.instrument} SL → ${roundedSL.toFixed(decimals)}`,
      )
    } catch (err) {
      console.error(`[trade-finder-mgr] Trail SL failed for ${setup.instrument}:`, err)
    }
  }

  private async timeBasedExit(managed: ManagedTrade, _trade: OpenTradeData): Promise<void> {
    if (!this.closeTradeFn) return

    const { setup } = managed
    try {
      await this.closeTradeFn(
        managed.sourceTradeId,
        undefined, // Full close
        "Trade Finder time-based exit — no progress",
      )
      this.managedTrades.delete(managed.sourceTradeId)

      console.log(`[trade-finder-mgr] TIME EXIT: ${setup.instrument} closed — no progress`)
    } catch (err) {
      console.error(`[trade-finder-mgr] Time exit failed for ${setup.instrument}:`, err)
    }
  }

  private getCandleMinutes(timeframeSet: string): number {
    const map: Record<string, number> = {
      hourly: 5, // LTF is M5
      daily: 15, // LTF is M15
      weekly: 60, // LTF is H1
      monthly: 240, // LTF is H4 (approximate)
    }
    return map[timeframeSet] ?? 15
  }
}
