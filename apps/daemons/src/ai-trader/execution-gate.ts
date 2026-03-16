import type { AiTraderConfigData, AiTraderOperatingMode } from "@fxflow/types"
import { countOpenAiTrades } from "@fxflow/db"
import { isMarketExpectedOpen } from "@fxflow/shared"
import type { CostTracker } from "./cost-tracker.js"

// ─── Gate Result ─────────────────────────────────────────────────────────────

export interface GateResult {
  allowed: boolean
  reason: string | null
}

// ─── Execution Gate ──────────────────────────────────────────────────────────

/**
 * ExecutionGate determines whether an opportunity should be auto-executed,
 * presented for manual approval, or skipped entirely.
 */
export class ExecutionGate {
  constructor(private costTracker: CostTracker) {}

  /**
   * Pre-scan check: should the scanner even run?
   */
  async canScan(config: AiTraderConfigData): Promise<GateResult> {
    if (!config.enabled) {
      return { allowed: false, reason: "AI Trader is disabled" }
    }

    if (!isMarketExpectedOpen(new Date())) {
      return { allowed: false, reason: "Market is closed" }
    }

    // Check budget before even scanning (Tier 2 costs money)
    const dailyCost = await this.costTracker.getDailyCost()
    if (dailyCost >= config.dailyBudgetUsd) {
      return {
        allowed: false,
        reason: `Daily budget exhausted ($${dailyCost.toFixed(2)} / $${config.dailyBudgetUsd.toFixed(2)})`,
      }
    }

    const monthlyCost = await this.costTracker.getMonthlyCost()
    if (monthlyCost >= config.monthlyBudgetUsd) {
      return {
        allowed: false,
        reason: `Monthly budget exhausted ($${monthlyCost.toFixed(2)} / $${config.monthlyBudgetUsd.toFixed(2)})`,
      }
    }

    return { allowed: true, reason: null }
  }

  /**
   * Pre-Tier-3 check: can we proceed to deep analysis?
   * Checks constraints (concurrent trades, existing position, budget) but NOT confidence.
   * Confidence is checked post-Tier-3 with the final score.
   */
  async canProceedToTier3(
    config: AiTraderConfigData,
    instrument: string,
    hasExistingPosition: (instrument: string) => boolean,
  ): Promise<GateResult> {
    // Max concurrent trades check
    const openCount = await countOpenAiTrades()
    if (openCount >= config.maxConcurrentTrades) {
      return {
        allowed: false,
        reason: `Max concurrent trades reached (${openCount}/${config.maxConcurrentTrades})`,
      }
    }

    // Check if instrument already has an AI trade
    if (hasExistingPosition(instrument)) {
      return { allowed: false, reason: `Already have a position on ${instrument}` }
    }

    // Budget check (estimate ~$0.01 for Tier 3 call)
    const estimatedCost = 0.01
    if (await this.costTracker.wouldExceedDailyBudget(estimatedCost, config.dailyBudgetUsd)) {
      return { allowed: false, reason: "Would exceed daily budget" }
    }

    return { allowed: true, reason: null }
  }

  /**
   * Post-Tier-3 check: should we place the trade?
   * Uses the final Tier 3 confidence for minimum confidence and auto-execute decisions.
   */
  checkFinalConfidence(
    config: AiTraderConfigData,
    confidence: number,
  ): GateResult & { autoExecute: boolean } {
    if (confidence < config.minimumConfidence) {
      return {
        allowed: false,
        reason: `Final confidence ${confidence}% below minimum ${config.minimumConfidence}%`,
        autoExecute: false,
      }
    }

    const autoExecute = this.shouldAutoExecute(
      config.operatingMode,
      confidence,
      config.confidenceThreshold,
    )

    return { allowed: true, reason: null, autoExecute }
  }

  /**
   * Determine whether a trade should be auto-executed based on operating mode.
   */
  shouldAutoExecute(
    mode: AiTraderOperatingMode,
    confidence: number,
    confidenceThreshold: number,
  ): boolean {
    switch (mode) {
      case "manual":
        return false // Always require user approval
      case "semi_auto":
        return confidence >= confidenceThreshold
      case "full_auto":
        return true // Auto-execute everything above minimum
      default:
        return false
    }
  }

  /**
   * Check if the TV Alerts kill switch is engaged (shared kill switch).
   */
  async isKillSwitchEngaged(): Promise<boolean> {
    try {
      const { getTVAlertsConfig } = await import("@fxflow/db")
      const tvConfig = await getTVAlertsConfig()
      return !tvConfig.enabled // If TV alerts disabled, kill switch is ON
    } catch {
      return false // If we can't read config, don't block
    }
  }

  /**
   * Pre-Tier-3 gate: checks kill switch + constraints (not confidence).
   * Call this BEFORE Tier 3 to avoid wasting API budget on blocked trades.
   */
  async preTier3Check(
    config: AiTraderConfigData,
    instrument: string,
    hasExistingPosition: (instrument: string) => boolean,
  ): Promise<GateResult> {
    // Kill switch
    if (await this.isKillSwitchEngaged()) {
      return { allowed: false, reason: "Kill switch is engaged" }
    }

    return this.canProceedToTier3(config, instrument, hasExistingPosition)
  }

  /**
   * Post-Tier-3 gate: checks final confidence + auto-execute decision.
   * Call this AFTER Tier 3 with the final confidence score.
   */
  postTier3Check(
    config: AiTraderConfigData,
    finalConfidence: number,
  ): GateResult & { autoExecute: boolean } {
    return this.checkFinalConfidence(config, finalConfidence)
  }
}
