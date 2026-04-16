/**
 * EdgeFinder AI re-evaluator.
 *
 * Periodically asks Sonnet to reassess an open AI-placed trade and either
 * suggest or execute a management action (adjust SL/TP, partial close, or
 * full close if the original thesis is invalidated).
 *
 * Complements the rule-based trade-manager (breakeven / trailing / time
 * exit / news protection). Rules handle the mechanical side; the
 * re-evaluator handles the "has the thesis changed?" question — which rules
 * can't reason about but Sonnet can.
 *
 * The existing `buildReEvalPrompt()` in `prompt-builder.ts` has been sitting
 * there since day one, waiting for a caller. This is that caller.
 *
 * Budget-gated via `CostTracker` (same daily/monthly caps as scanning).
 * Grace-period gated so we don't re-evaluate a trade that just filled.
 *
 * @module ai-trader/re-evaluator
 */

import Anthropic from "@anthropic-ai/sdk"
import type {
  AiTraderManagementAction,
  AiTraderManagementConfig,
  AiTraderOpportunityData,
  AnyDaemonMessage,
} from "@fxflow/types"
import { appendManagementAction, getDecryptedClaudeKey, updateOpportunityStatus } from "@fxflow/db"
import { computeProfitPips, getPipSize } from "@fxflow/shared"
import { buildReEvalPrompt, type ReEvalContext } from "./prompt-builder.js"
import type { CostTracker } from "./cost-tracker.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal runtime state the re-evaluator needs for a managed trade. */
export interface ReEvaluatorTradeRef {
  opportunityId: string
  tradeId: string
  sourceTradeId: string
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentSL: number
  currentTP: number
  openedAt: number
  atr: number
  /** Epoch ms of last re-evaluation for this trade, or 0 if never. */
  lastReEvalAt: number
}

export interface ReEvalDecision {
  action: "hold" | "adjust_sl" | "adjust_tp" | "partial_close" | "close" | "scale_in"
  newSL: number | null
  newTP: number | null
  closePercent: number | null
  reason: string
  confidence: number
}

// ─── Class ───────────────────────────────────────────────────────────────────

export class AiReEvaluator {
  constructor(
    private tradeSyncer: OandaTradeSyncer,
    private costTracker: CostTracker,
    private broadcast: (msg: AnyDaemonMessage) => void,
  ) {}

  /**
   * Decide whether a trade is due for re-evaluation and (if so) run it.
   * Returns true if a Claude call happened so the caller can rate-limit.
   */
  async maybeReEvaluate(
    managed: ReEvaluatorTradeRef,
    currentPrice: number,
    managementLog: AiTraderManagementAction[],
    mgmt: AiTraderManagementConfig,
    opp: AiTraderOpportunityData,
  ): Promise<boolean> {
    if (!mgmt.reEvaluationEnabled) return false
    if (mgmt.reEvaluationMode === "off") return false

    const now = Date.now()

    // Grace period after fill
    const graceMs = (mgmt.reEvaluationGraceMinutes ?? 15) * 60_000
    if (now - managed.openedAt < graceMs) return false

    // Per-trade interval gate
    const intervalMs = (mgmt.reEvaluationIntervalHours ?? 2) * 3_600_000
    if (managed.lastReEvalAt > 0 && now - managed.lastReEvalAt < intervalMs) return false

    // Budget check — re-evaluation uses the same Sonnet budget as Tier 3.
    // Estimate ~\$0.02 per call and bail if we'd exceed daily cap.
    const estimatedCost = 0.02
    const { getAiTraderConfig } = await import("@fxflow/db")
    const fullConfig = await getAiTraderConfig()
    if (!fullConfig) return false
    if (await this.costTracker.wouldExceedDailyBudget(estimatedCost, fullConfig.dailyBudgetUsd)) {
      console.log("[ai-trader-reeval] Skipping re-eval — daily budget would be exceeded")
      return false
    }

    managed.lastReEvalAt = now

    try {
      const apiKey = await getDecryptedClaudeKey()
      if (!apiKey) return false

      const profitPips = computeProfitPips({
        instrument: managed.instrument,
        direction: managed.direction,
        entryPrice: managed.entryPrice,
        currentPrice,
      })
      const unrealizedPL = profitPips * getPipSize(managed.instrument) // rough, account-currency conversion left to caller
      const hoursOpen = (now - managed.openedAt) / 3_600_000

      // Build the existing ReEval prompt (lives in prompt-builder.ts).
      const ctx: ReEvalContext = {
        instrument: managed.instrument,
        direction: managed.direction,
        entryPrice: managed.entryPrice,
        currentPrice,
        currentSL: managed.currentSL,
        currentTP: managed.currentTP,
        unrealizedPL,
        managementLog: managementLog.map((e) => ({
          action: e.action,
          detail: e.detail,
          timestamp: e.timestamp,
        })),
        snapshot:
          (typeof opp.technicalSnapshot === "string"
            ? JSON.parse(opp.technicalSnapshot)
            : opp.technicalSnapshot) ?? {},
        hoursOpen,
      }
      const prompt = buildReEvalPrompt(ctx)

      const anthropic = new Anthropic({ apiKey })
      const response = await anthropic.messages.create({
        model: fullConfig.decisionModel || "claude-sonnet-4-6",
        max_tokens: 600,
        system: [
          {
            type: "text" as const,
            text: prompt.system,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user" as const, content: prompt.user }],
      })
      this.costTracker.invalidateCache()

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
      const decision = this.parseDecision(text)
      if (!decision) return true // call happened, just couldn't parse

      if (decision.action === "hold") {
        await this.logReEval(managed, decision, "hold", mgmt.reEvaluationMode)
        return true
      }

      // Gate auto-execution on mode + confidence
      const autoExecute =
        mgmt.reEvaluationMode === "auto" &&
        decision.confidence >= (mgmt.reEvaluationMinConfidence ?? 75)

      if (autoExecute) {
        await this.executeDecision(managed, decision)
      }
      await this.logReEval(
        managed,
        decision,
        autoExecute ? "executed" : "suggested",
        mgmt.reEvaluationMode,
      )
      return true
    } catch (err) {
      console.warn(
        `[ai-trader-reeval] Re-evaluation failed for ${managed.instrument}:`,
        (err as Error).message,
      )
      return true
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private parseDecision(raw: string): ReEvalDecision | null {
    try {
      const cleaned = raw
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim()
      const start = cleaned.indexOf("{")
      const end = cleaned.lastIndexOf("}")
      if (start < 0 || end < 0) return null
      return JSON.parse(cleaned.slice(start, end + 1)) as ReEvalDecision
    } catch {
      return null
    }
  }

  private async executeDecision(
    managed: ReEvaluatorTradeRef,
    decision: ReEvalDecision,
  ): Promise<void> {
    switch (decision.action) {
      case "adjust_sl":
        if (decision.newSL != null) {
          await this.tradeSyncer.modifyTradeSLTP(managed.sourceTradeId, decision.newSL)
          managed.currentSL = decision.newSL
        }
        break
      case "adjust_tp":
        if (decision.newTP != null) {
          await this.tradeSyncer.modifyTradeSLTP(managed.sourceTradeId, undefined, decision.newTP)
          managed.currentTP = decision.newTP
        }
        break
      case "close":
        await this.tradeSyncer.closeTrade(
          managed.sourceTradeId,
          undefined,
          `EdgeFinder AI re-eval: ${decision.reason}`,
          {
            closedBy: "ai_trader",
            closedByLabel: "EdgeFinder",
            closedByDetail: `AI re-evaluation closed (${decision.confidence}% confidence)`,
          },
        )
        break
      case "partial_close":
        console.log("[ai-trader-reeval] Partial close via re-eval not yet wired to units")
        break
      case "scale_in":
        // Scale-in: AI re-evaluator concluded the thesis is strengthening at 2R+.
        // Logs the intent — actual placement requires the scanner's placeOrder
        // flow which isn't accessible from the trade-manager context. Future
        // work: emit a WS event so the scanner can queue an add-to-position order.
        console.log(
          `[ai-trader-reeval] Scale-in suggested for ${managed.instrument} ` +
            `${managed.direction} (${decision.confidence}% confidence)`,
        )
        break
    }
  }

  private async logReEval(
    managed: ReEvaluatorTradeRef,
    decision: ReEvalDecision,
    disposition: "hold" | "suggested" | "executed",
    mode: AiTraderManagementConfig["reEvaluationMode"],
  ): Promise<void> {
    const entry: AiTraderManagementAction = {
      action: "re_evaluate",
      detail: `[${mode}→${disposition}] ${decision.action} (${decision.confidence}%): ${decision.reason}`,
      previousValue:
        decision.action === "adjust_sl"
          ? managed.currentSL
          : decision.action === "adjust_tp"
            ? managed.currentTP
            : undefined,
      newValue:
        decision.action === "adjust_sl"
          ? (decision.newSL ?? undefined)
          : decision.action === "adjust_tp"
            ? (decision.newTP ?? undefined)
            : undefined,
      timestamp: new Date().toISOString(),
    }
    await appendManagementAction(managed.opportunityId, entry)
    await updateOpportunityStatus(managed.opportunityId, "managed")
    this.broadcast({
      type: "ai_trader_trade_managed",
      timestamp: new Date().toISOString(),
      data: {
        opportunityId: managed.opportunityId,
        tradeId: managed.tradeId,
        action: entry,
      },
    })
  }
}
