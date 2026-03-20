import type {
  AiTraderManagementConfig,
  AiTraderManagementAction,
  AiTraderOpportunityData,
  AiTraderProfile,
  AnyDaemonMessage,
} from "@fxflow/types"
import {
  getActiveOpportunities,
  updateOpportunityStatus,
  appendManagementAction,
  findOpportunityByResultTradeId,
} from "@fxflow/db"
import { getPipSize, priceToPips } from "@fxflow/shared"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { PositionManager } from "../positions/position-manager.js"
import type { NotificationEmitter } from "../notification-emitter.js"
import type { DataAggregator } from "./data-aggregator.js"
import type { PerformanceTracker } from "./performance-tracker.js"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ManagedTrade {
  opportunityId: string
  tradeId: string
  sourceTradeId: string
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentSL: number
  currentTP: number
  units: number
  breakevenApplied: boolean
  partialCloseApplied: boolean
  openedAt: number // timestamp ms
  atr: number // real ATR from Tier 1 analysis
  profile: AiTraderProfile
}

/** Profile-specific maximum hold time in hours */
const PROFILE_TIME_LIMITS: Record<AiTraderProfile, number> = {
  scalper: 8,
  intraday: 48,
  swing: 168,
  news: 4,
}

// ─── Trade Manager ───────────────────────────────────────────────────────────

/**
 * TradeManager monitors and manages open AI trades.
 * Handles breakeven, trailing stops, partial closes, time exits, and news protection.
 */
export class TradeManager {
  private managedTrades = new Map<string, ManagedTrade>()
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private priceMap: Record<string, number> = {}

  constructor(
    private tradeSyncer: OandaTradeSyncer,
    private positionManager: PositionManager,
    private broadcast: (msg: AnyDaemonMessage) => void,
    private notificationEmitter: NotificationEmitter | null,
    private dataAggregator: DataAggregator,
    private performanceTracker: PerformanceTracker,
  ) {}

  async start(): Promise<void> {
    // Load existing managed opportunities from DB
    const active = await getActiveOpportunities()
    for (const opp of active) {
      if (opp.status === "filled" || opp.status === "managed") {
        this.trackOpportunity(opp)
      }
    }

    // Check management conditions every 30 seconds
    this.checkTimer = setInterval(() => {
      void this.runManagementCycle()
    }, 30_000)

    console.log(`[ai-trader] Trade manager started with ${this.managedTrades.size} active trades`)
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /**
   * Called on every price tick from PositionPriceTracker.
   */
  onPriceTick(instrument: string, mid: number): void {
    this.priceMap[instrument] = mid
  }

  /**
   * Start tracking a new AI trade.
   */
  trackOpportunity(opp: AiTraderOpportunityData): void {
    if (!opp.resultTradeId || !opp.resultSourceId) return

    // Extract real ATR from the stored technical snapshot
    let atr = getPipSize(opp.instrument) * 20 // fallback
    try {
      const snapshot =
        typeof opp.technicalSnapshot === "string"
          ? JSON.parse(opp.technicalSnapshot)
          : opp.technicalSnapshot
      if (snapshot?.atr && typeof snapshot.atr === "number") {
        atr = snapshot.atr
      }
    } catch {
      // Use fallback
    }

    this.managedTrades.set(opp.resultTradeId, {
      opportunityId: opp.id,
      tradeId: opp.resultTradeId,
      sourceTradeId: opp.resultSourceId,
      instrument: opp.instrument,
      direction: opp.direction,
      entryPrice: opp.entryPrice,
      currentSL: opp.stopLoss,
      currentTP: opp.takeProfit,
      units: opp.positionSize,
      breakevenApplied: opp.managementLog.some((a) => a.action === "breakeven"),
      partialCloseApplied: opp.managementLog.some((a) => a.action === "partial_close"),
      openedAt: opp.filledAt ? new Date(opp.filledAt).getTime() : Date.now(),
      atr,
      profile: opp.profile,
    })
  }

  /**
   * Called when an AI trade is closed (by any means).
   */
  async onTradeClosed(tradeId: string, realizedPL: number): Promise<void> {
    const managed = this.managedTrades.get(tradeId)
    if (!managed) return

    this.managedTrades.delete(tradeId)

    const outcome =
      realizedPL > 0
        ? ("win" as const)
        : realizedPL < 0
          ? ("loss" as const)
          : ("breakeven" as const)

    // Update opportunity status
    const opp = await findOpportunityByResultTradeId(tradeId)
    if (opp) {
      await updateOpportunityStatus(opp.id, "closed", {
        realizedPL,
        outcome,
        closedAt: new Date(),
      })

      // Record to performance tracker
      await this.performanceTracker.recordOutcome({
        profile: opp.profile,
        instrument: opp.instrument,
        session: opp.session,
        technique: opp.primaryTechnique,
        realizedPL,
        riskRewardRatio: opp.riskRewardRatio,
        outcome,
      })

      // Broadcast
      this.broadcast({
        type: "ai_trader_trade_closed",
        timestamp: new Date().toISOString(),
        data: {
          opportunityId: opp.id,
          tradeId,
          instrument: opp.instrument,
          direction: opp.direction,
          outcome,
          realizedPL,
          confidence: opp.confidence,
        },
      })

      // Notification
      const prefix = realizedPL >= 0 ? "+" : ""
      await this.notificationEmitter?.emitAiTrader(
        `EdgeFinder Trade Closed (${outcome.toUpperCase()})`,
        `${opp.instrument.replace("_", "/")} ${opp.direction} — ${prefix}$${realizedPL.toFixed(2)}`,
        outcome === "win" ? "info" : "warning",
      )
    }
  }

  /**
   * Check if a tradeId is managed by the AI Trader.
   */
  isAiTrade(tradeId: string): boolean {
    return this.managedTrades.has(tradeId)
  }

  // ─── Management Cycle ──────────────────────────────────────────────

  private async runManagementCycle(): Promise<void> {
    for (const [tradeId, managed] of this.managedTrades) {
      try {
        const currentPrice = this.priceMap[managed.instrument]
        if (!currentPrice) continue

        // Get config
        const { getAiTraderConfig } = await import("@fxflow/db")
        const config = await getAiTraderConfig()
        if (!config) continue

        const mgmt = config.managementConfig as AiTraderManagementConfig

        await this.checkBreakeven(managed, currentPrice, mgmt)
        await this.checkTrailingStop(managed, currentPrice, mgmt)
        await this.checkTimeExit(managed, mgmt)
        await this.checkNewsProtection(managed, mgmt)
      } catch (err) {
        console.error(`[ai-trader] Management error for ${tradeId}:`, (err as Error).message)
      }
    }
  }

  private async checkBreakeven(
    managed: ManagedTrade,
    currentPrice: number,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.breakevenEnabled || managed.breakevenApplied) return

    const riskPips = priceToPips(
      managed.instrument,
      Math.abs(managed.entryPrice - managed.currentSL),
    )
    const profitPips =
      managed.direction === "long"
        ? priceToPips(managed.instrument, currentPrice - managed.entryPrice)
        : priceToPips(managed.instrument, managed.entryPrice - currentPrice)

    const triggerPips = riskPips * mgmt.breakevenTriggerRR

    if (profitPips >= triggerPips) {
      // Move SL to breakeven (entry price + small buffer)
      const pipSize = getPipSize(managed.instrument)
      const buffer = pipSize * 2 // 2 pip buffer
      const newSL =
        managed.direction === "long" ? managed.entryPrice + buffer : managed.entryPrice - buffer

      await this.modifyTradeAndLog(
        managed,
        "breakeven",
        newSL,
        managed.currentTP,
        `Moved SL to breakeven at ${newSL.toFixed(5)} (trade reached ${mgmt.breakevenTriggerRR}R)`,
        managed.currentSL,
        newSL,
      )
      managed.breakevenApplied = true
    }
  }

  private async checkTrailingStop(
    managed: ManagedTrade,
    currentPrice: number,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.trailingStopEnabled || !managed.breakevenApplied) return

    // Only trail after breakeven is applied — use real ATR from Tier 1 analysis
    const trailDistance = managed.atr * mgmt.trailingStopAtrMultiplier

    let newSL: number
    if (managed.direction === "long") {
      newSL = currentPrice - trailDistance
      if (newSL <= managed.currentSL) return // Only tighten, never widen
    } else {
      newSL = currentPrice + trailDistance
      if (newSL >= managed.currentSL) return
    }

    await this.modifyTradeAndLog(
      managed,
      "trailing_update",
      newSL,
      managed.currentTP,
      `Trailing stop updated to ${newSL.toFixed(5)}`,
      managed.currentSL,
      newSL,
    )
  }

  private async checkTimeExit(
    managed: ManagedTrade,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.timeExitEnabled) return

    const hoursOpen = (Date.now() - managed.openedAt) / 3_600_000
    const maxHours = PROFILE_TIME_LIMITS[managed.profile] ?? mgmt.timeExitHours
    if (hoursOpen >= maxHours) {
      // Close the trade
      try {
        await this.tradeSyncer.closeTrade(managed.sourceTradeId)
        await this.logAction(
          managed,
          "close",
          `Time exit after ${hoursOpen.toFixed(1)} hours (limit: ${mgmt.timeExitHours}h)`,
        )
      } catch (err) {
        console.warn(
          `[ai-trader] Time exit failed for ${managed.instrument}:`,
          (err as Error).message,
        )
      }
    }
  }

  private async checkNewsProtection(
    managed: ManagedTrade,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.newsProtectionEnabled) return

    const [base, quote] = managed.instrument.split("_") as [string, string]
    const hasUpcoming =
      (await this.dataAggregator.hasUpcomingHighImpact(base, 30)) ||
      (await this.dataAggregator.hasUpcomingHighImpact(quote, 30))

    if (hasUpcoming) {
      // Tighten SL to reduce risk before news
      const pipSize = getPipSize(managed.instrument)
      const tightenAmount = pipSize * 5

      let newSL: number
      if (managed.direction === "long") {
        newSL = managed.currentSL + tightenAmount
        if (newSL >= this.priceMap[managed.instrument]!) return // Don't close via SL tightening
      } else {
        newSL = managed.currentSL - tightenAmount
        if (newSL <= this.priceMap[managed.instrument]!) return
      }

      await this.modifyTradeAndLog(
        managed,
        "news_protection",
        newSL,
        managed.currentTP,
        `Tightened SL before high-impact news event`,
        managed.currentSL,
        newSL,
      )
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private async modifyTradeAndLog(
    managed: ManagedTrade,
    action: AiTraderManagementAction["action"],
    newSL: number,
    newTP: number,
    detail: string,
    previousValue?: number,
    newValue?: number,
  ): Promise<void> {
    try {
      await this.tradeSyncer.modifyTradeSLTP(managed.sourceTradeId, newSL, newTP)
      managed.currentSL = newSL
      managed.currentTP = newTP
      await this.logAction(managed, action, detail, previousValue, newValue)
    } catch (err) {
      console.warn(
        `[ai-trader] Modify trade failed for ${managed.instrument}:`,
        (err as Error).message,
      )
    }
  }

  private async logAction(
    managed: ManagedTrade,
    action: AiTraderManagementAction["action"],
    detail: string,
    previousValue?: number,
    newValue?: number,
  ): Promise<void> {
    const mgmtAction: AiTraderManagementAction = {
      action,
      detail,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
    }

    await appendManagementAction(managed.opportunityId, mgmtAction)

    // Update status to "managed" if not already
    await updateOpportunityStatus(managed.opportunityId, "managed")

    this.broadcast({
      type: "ai_trader_trade_managed",
      timestamp: new Date().toISOString(),
      data: {
        opportunityId: managed.opportunityId,
        tradeId: managed.tradeId,
        action: mgmtAction,
      },
    })
  }
}
