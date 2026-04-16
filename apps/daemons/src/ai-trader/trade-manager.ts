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
import {
  getPipSize,
  computeProfitPips,
  computeRiskPips,
  evaluateBreakeven,
  evaluateTrailing,
  evaluateTimeExit,
} from "@fxflow/shared"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { PositionManager } from "../positions/position-manager.js"
import type { NotificationEmitter } from "../notification-emitter.js"
import type { DataAggregator } from "./data-aggregator.js"
import type { PerformanceTracker } from "./performance-tracker.js"
import type { CostTracker } from "./cost-tracker.js"
import { AiReEvaluator } from "./re-evaluator.js"

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract the managementPlan string from a stored Tier 3 JSON response. */
function extractManagementPlan(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start < 0 || end < 0) return null
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { managementPlan?: string }
    return parsed.managementPlan ?? null
  } catch {
    return null
  }
}

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
  /** Original SL price at fill. Used to cap news-protection tightening. */
  originalSL: number
  units: number
  breakevenApplied: boolean
  partialCloseApplied: boolean
  openedAt: number // timestamp ms
  atr: number // real ATR from Tier 1 analysis
  profile: AiTraderProfile
  /** Epoch ms of last AI re-evaluation call for this trade, 0 if never. */
  lastReEvalAt: number
  /** Tier 3's management plan text. Stored for context in AI re-evaluation
   *  prompts and for the re-evaluator to reference the original thesis. */
  managementPlan: string | null
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
  private aiReEvaluator: AiReEvaluator | null = null

  constructor(
    private tradeSyncer: OandaTradeSyncer,
    private positionManager: PositionManager,
    private broadcast: (msg: AnyDaemonMessage) => void,
    private notificationEmitter: NotificationEmitter | null,
    private dataAggregator: DataAggregator,
    private performanceTracker: PerformanceTracker,
  ) {}

  /** Called from the scanner at construction time to enable AI re-evaluation. */
  setCostTracker(costTracker: CostTracker): void {
    this.aiReEvaluator = new AiReEvaluator(this.tradeSyncer, costTracker, this.broadcast)
  }

  async start(): Promise<void> {
    // Load existing managed opportunities from DB
    const active = await getActiveOpportunities()
    for (const opp of active) {
      if (opp.status === "filled" || opp.status === "managed") {
        this.trackOpportunity(opp)
      }
    }

    // Management cycle interval adapts to the fastest active profile:
    // scalper/news (10s) need faster checks than swing (30s). We use the
    // fastest profile among managed trades, re-evaluated every cycle.
    this.scheduleNextCycle()

    console.log(`[ai-trader] Trade manager started with ${this.managedTrades.size} active trades`)
  }

  stop(): void {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer)
      this.checkTimer = null
    }
  }

  private static readonly PROFILE_CYCLE_MS: Record<string, number> = {
    scalper: 10_000,
    news: 10_000,
    intraday: 15_000,
    swing: 30_000,
  }

  private scheduleNextCycle(): void {
    // Pick the fastest interval among currently managed trade profiles.
    // Falls back to 30s if no trades are managed (idle).
    let fastest = 30_000
    for (const managed of this.managedTrades.values()) {
      const interval = TradeManager.PROFILE_CYCLE_MS[managed.profile] ?? 30_000
      if (interval < fastest) fastest = interval
    }
    this.checkTimer = setTimeout(() => {
      void this.runManagementCycle().finally(() => this.scheduleNextCycle())
    }, fastest)
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
      originalSL: opp.stopLoss,
      units: opp.positionSize,
      breakevenApplied: opp.managementLog.some((a) => a.action === "breakeven"),
      partialCloseApplied: opp.managementLog.some((a) => a.action === "partial_close"),
      openedAt: opp.filledAt ? new Date(opp.filledAt).getTime() : Date.now(),
      atr,
      profile: opp.profile,
      lastReEvalAt: 0,
      // Extract Tier 3's management plan from the stored tier3Response so the
      // re-evaluator can reference it. Graceful if parsing fails.
      managementPlan: extractManagementPlan(opp.tier3Response),
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
        await this.checkPartialClose(managed, currentPrice, mgmt)
        await this.checkTrailingStop(managed, currentPrice, mgmt)
        await this.checkTimeExit(managed, mgmt)
        await this.checkNewsProtection(managed, mgmt)
        await this.checkAiReEvaluation(managed, currentPrice, mgmt)
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
    if (!mgmt.breakevenEnabled) return

    const riskPips = computeRiskPips({
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      stopLoss: managed.currentSL,
    })
    const profitPips = computeProfitPips({
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      currentPrice,
    })

    // ATR-proportional breakeven buffer: 10% of ATR in pips, minimum 2 pips.
    // Post-mortem showed the fixed 2-pip buffer was too tight for swing trades
    // with 50-100 pip SL — any normal spread fluctuation stops out at BE.
    const pipSize = getPipSize(managed.instrument)
    const atrPips = managed.atr / pipSize
    const bufferPips = Math.max(mgmt.breakevenBufferPips ?? 2, Math.round(atrPips * 0.1))

    const decision = evaluateBreakeven({
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      currentSL: managed.currentSL,
      profitPips,
      thresholdPips: riskPips * mgmt.breakevenTriggerRR,
      bufferPips,
      alreadyApplied: managed.breakevenApplied,
    })

    if (!decision.shouldFire || decision.newSL == null) return

    await this.modifyTradeAndLog(
      managed,
      "breakeven",
      decision.newSL,
      managed.currentTP,
      `Moved SL to breakeven at ${decision.newSL.toFixed(5)} (trade reached ${mgmt.breakevenTriggerRR}R)`,
      managed.currentSL,
      decision.newSL,
    )
    managed.breakevenApplied = true
  }

  /**
   * Close a fraction of the position at a configurable R:R target.
   * This was identified as dead config in the post-mortem — enabled in
   * AiTraderManagementConfig but never implemented, so zero trades ever
   * had a partial close. Now it fires at `partialCloseTargetRR` (default
   * 1.5) and closes `partialClosePercent` (default 50%) of the position.
   */
  private async checkPartialClose(
    managed: ManagedTrade,
    currentPrice: number,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.partialCloseEnabled || managed.partialCloseApplied) return
    // Only partial-close after breakeven is set (we need risk locked in first)
    if (!managed.breakevenApplied) return

    const riskPips = computeRiskPips({
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      stopLoss: managed.originalSL,
    })
    const profitPips = computeProfitPips({
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      currentPrice,
    })
    const currentRR = riskPips > 0 ? profitPips / riskPips : 0
    if (currentRR < mgmt.partialCloseTargetRR) return

    // Close the configured percentage of the position
    const closeUnits = Math.max(1, Math.floor(managed.units * (mgmt.partialClosePercent / 100)))
    try {
      await this.tradeSyncer.closeTrade(
        managed.sourceTradeId,
        closeUnits,
        `EdgeFinder partial close: ${mgmt.partialClosePercent}% at ${currentRR.toFixed(1)}R`,
        {
          closedBy: "ai_trader",
          closedByLabel: "EdgeFinder",
          closedByDetail: `Partial close ${mgmt.partialClosePercent}% at ${currentRR.toFixed(1)}R (${profitPips.toFixed(1)} pips profit)`,
        },
      )
      managed.partialCloseApplied = true
      managed.units -= closeUnits
      await this.logAction(
        managed,
        "partial_close",
        `Closed ${closeUnits} units (${mgmt.partialClosePercent}%) at ${currentRR.toFixed(1)}R — ${profitPips.toFixed(1)} pips profit`,
        undefined,
        closeUnits,
      )
    } catch (err) {
      console.warn(
        `[ai-trader] Partial close failed for ${managed.instrument}:`,
        (err as Error).message,
      )
    }
  }

  private async checkTrailingStop(
    managed: ManagedTrade,
    currentPrice: number,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.trailingStopEnabled) return

    // Progressive trailing: tighten the trail distance as profit grows.
    // At 1R: standard trail distance (trailingStopAtrMultiplier × ATR)
    // At 2R+: half the trail distance so we lock in more of the move.
    // This was added after post-mortem analysis showed GBP_USD running
    // 191 pips MFE but closing at breakeven on the pullback — the
    // standard trail was too wide to capture the move.
    const profitPips = computeProfitPips({
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      currentPrice,
    })
    const riskPips = computeRiskPips({
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      stopLoss: managed.originalSL,
    })
    const currentRR = riskPips > 0 ? profitPips / riskPips : 0
    const trailMultiplier =
      currentRR >= 2
        ? mgmt.trailingStopAtrMultiplier * 0.5 // Tighter at 2R+
        : mgmt.trailingStopAtrMultiplier

    const decision = evaluateTrailing({
      instrument: managed.instrument,
      direction: managed.direction,
      currentPrice,
      currentSL: managed.currentSL,
      trailDistancePrice: managed.atr * trailMultiplier,
      // EdgeFinder only trails after breakeven is applied.
      activated: managed.breakevenApplied,
    })
    if (!decision.shouldFire || decision.newSL == null) return

    await this.modifyTradeAndLog(
      managed,
      "trailing_update",
      decision.newSL,
      managed.currentTP,
      `Trailing stop updated to ${decision.newSL.toFixed(5)}${currentRR >= 2 ? " (tight trail at 2R+)" : ""}`,
      managed.currentSL,
      decision.newSL,
    )
  }

  private async checkTimeExit(
    managed: ManagedTrade,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.timeExitEnabled) return

    // Prefer a per-profile override from config; fall back to the generic timeExitHours.
    const maxHours = mgmt.profileTimeLimits?.[managed.profile] ?? mgmt.timeExitHours
    const decision = evaluateTimeExit({ openedAt: managed.openedAt, maxHours })
    if (!decision.shouldFire) return

    try {
      await this.tradeSyncer.closeTrade(
        managed.sourceTradeId,
        undefined,
        `EdgeFinder time exit (${decision.hoursOpen.toFixed(1)}h)`,
        {
          closedBy: "ai_trader",
          closedByLabel: "EdgeFinder",
          closedByDetail: `Time exit after ${decision.hoursOpen.toFixed(1)}h (limit ${maxHours}h)`,
        },
      )
      await this.logAction(
        managed,
        "close",
        `Time exit after ${decision.hoursOpen.toFixed(1)} hours (limit: ${maxHours}h)`,
      )
    } catch (err) {
      console.warn(
        `[ai-trader] Time exit failed for ${managed.instrument}:`,
        (err as Error).message,
      )
    }
  }

  /** Epoch ms of last news protection SL tightening, keyed by tradeId. */
  private lastNewsTightenAt = new Map<string, number>()

  private async checkNewsProtection(
    managed: ManagedTrade,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!mgmt.newsProtectionEnabled) return

    // Debounce: at most one tightening per 30 minutes per trade. The previous
    // bug tightened every 30-second management cycle, firing 12 times in under
    // 6 minutes and compressing the SL to zero — guaranteed stop-out.
    const NEWS_TIGHTEN_DEBOUNCE_MS = 30 * 60_000
    const lastTighten = this.lastNewsTightenAt.get(managed.tradeId) ?? 0
    if (Date.now() - lastTighten < NEWS_TIGHTEN_DEBOUNCE_MS) return

    const bufferMinutes = mgmt.newsProtectionBufferMinutes ?? 30
    const [base, quote] = managed.instrument.split("_") as [string, string]
    const hasUpcoming =
      (await this.dataAggregator.hasUpcomingHighImpact(base, bufferMinutes)) ||
      (await this.dataAggregator.hasUpcomingHighImpact(quote, bufferMinutes))

    if (hasUpcoming) {
      // Cap: never tighten more than 50% of the original risk distance.
      // After that, the trade has been risk-reduced as much as is safe — further
      // tightening just guarantees a stop-out on the next pullback.
      const pipSize = getPipSize(managed.instrument)
      const originalRisk = Math.abs(managed.entryPrice - managed.originalSL)
      const currentRisk = Math.abs(
        managed.direction === "long"
          ? managed.currentSL - managed.originalSL
          : managed.originalSL - managed.currentSL,
      )
      if (currentRisk >= originalRisk * 0.5) {
        // Already tightened 50% of original risk — no further tightening.
        return
      }
      const tightenAmount = pipSize * (mgmt.newsProtectionTightenPips ?? 5)

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
      this.lastNewsTightenAt.set(managed.tradeId, Date.now())
    }
  }

  /**
   * Optional AI re-evaluation using the existing buildReEvalPrompt pipeline.
   * Gated by mgmt.reEvaluationEnabled + reEvaluationMode (off/suggest/auto),
   * an interval per trade, and a grace period after fill. Uses the shared
   * EdgeFinder budget (CostTracker) so runaway re-eval costs can't happen.
   */
  private async checkAiReEvaluation(
    managed: ManagedTrade,
    currentPrice: number,
    mgmt: AiTraderManagementConfig,
  ): Promise<void> {
    if (!this.aiReEvaluator) return
    if (!mgmt.reEvaluationEnabled || mgmt.reEvaluationMode === "off") return

    const opp = await findOpportunityByResultTradeId(managed.tradeId)
    if (!opp) return

    const ref = {
      opportunityId: managed.opportunityId,
      tradeId: managed.tradeId,
      sourceTradeId: managed.sourceTradeId,
      instrument: managed.instrument,
      direction: managed.direction,
      entryPrice: managed.entryPrice,
      currentSL: managed.currentSL,
      currentTP: managed.currentTP,
      openedAt: managed.openedAt,
      atr: managed.atr,
      lastReEvalAt: managed.lastReEvalAt,
    }
    const ran = await this.aiReEvaluator.maybeReEvaluate(
      ref,
      currentPrice,
      opp.managementLog,
      mgmt,
      opp,
    )
    if (ran) {
      managed.lastReEvalAt = ref.lastReEvalAt
      managed.currentSL = ref.currentSL
      managed.currentTP = ref.currentTP
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
    // Spread guard: if the proposed SL is inside the current bid/ask spread,
    // the OANDA API will reject it. Check before calling to avoid error spam
    // during high-spread periods (news, rollover, low liquidity).
    const livePrice = this.priceMap[managed.instrument]
    if (livePrice != null && newSL > 0) {
      const pipSize = getPipSize(managed.instrument)
      const distanceFromPrice = Math.abs(livePrice - newSL)
      // Reject if new SL is within 1.5 pips of current price (approximate
      // spread buffer; OANDA minimum distance is ~1 pip on majors).
      if (distanceFromPrice < pipSize * 1.5) {
        console.warn(
          `[ai-trader] Skipping ${action} on ${managed.instrument}: ` +
            `proposed SL ${newSL.toFixed(5)} is within spread of price ${livePrice.toFixed(5)}`,
        )
        return
      }
    }

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
