/**
 * Reflection engine — generates post-trade reflections asynchronously after
 * EdgeFinder trades close. Stores qualitative lessons that are injected into
 * future Judge prompts as "experience memory".
 *
 * Fire-and-forget: errors are logged but never block the trade close flow.
 *
 * @module reflection-engine
 */
import Anthropic from "@anthropic-ai/sdk"
import type { AiTraderOpportunityData, TradeOutcome } from "@fxflow/types"
import { AI_MODEL_OPTIONS } from "@fxflow/types"
import { createReflection, hasReflection, getDecryptedClaudeKey } from "@fxflow/db"
import { buildReflectionPrompt, type ReflectionContext } from "./prompt-builder.js"
import type { TechnicalSnapshot } from "./strategy-engine.js"

// ─── Helpers ────────────────────────────────────────────────────────────────

function getModelCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = AI_MODEL_OPTIONS.find((m) => modelId.includes(m.id) || m.id.includes(modelId))
  const inputCost = model?.inputCostPer1M ?? 0.8 // Haiku fallback
  const outputCost = model?.outputCostPer1M ?? 4
  return (inputTokens * inputCost + outputTokens * outputCost) / 1_000_000
}

function extractJSON<T>(text: string): T {
  try {
    return JSON.parse(text)
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (codeBlockMatch?.[1]) {
      try {
        return JSON.parse(codeBlockMatch[1])
      } catch {
        // fall through
      }
    }
    const braceMatch = text.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      return JSON.parse(braceMatch[0])
    }
    // Try truncation repair
    const openBrace = text.indexOf("{")
    if (openBrace >= 0) {
      const partial = text.slice(openBrace).replace(/```\s*$/, "")
      const lastQuote = partial.lastIndexOf('"')
      if (lastQuote > 0) {
        const truncated = partial.slice(0, lastQuote + 1) + "}"
        return JSON.parse(truncated)
      }
    }
    throw new Error("No valid JSON found")
  }
}

function safeParseSnapshot(snapshot: unknown): TechnicalSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") return null
  return snapshot as TechnicalSnapshot
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class ReflectionEngine {
  /** Default model for reflection generation (Haiku — cheap, good enough for structured summaries) */
  private readonly model = "claude-haiku-4-5-20251001"

  /**
   * Generate a post-trade reflection asynchronously. Fire-and-forget — errors
   * are logged but never propagated to the caller.
   */
  async generateReflection(
    opp: AiTraderOpportunityData,
    realizedPL: number,
    outcome: TradeOutcome,
  ): Promise<void> {
    try {
      // Don't reflect on cancelled trades — no lesson to extract
      if (outcome === "cancelled") return

      // Guard: don't generate duplicate reflections
      if (await hasReflection(opp.id)) return

      const apiKey = await getDecryptedClaudeKey()
      if (!apiKey) {
        console.warn("[reflection] No Claude API key — skipping reflection")
        return
      }

      const managementLog = (opp.managementLog ?? []).map((a) => ({
        action: a.action,
        detail: a.detail,
        timestamp: a.timestamp,
      }))

      // After the cancelled guard above, outcome is narrowed
      const reflectionOutcome = outcome as "win" | "loss" | "breakeven"

      const ctx: ReflectionContext = {
        instrument: opp.instrument,
        direction: opp.direction,
        profile: opp.profile,
        entryPrice: opp.entryPrice,
        stopLoss: opp.stopLoss,
        takeProfit: opp.takeProfit,
        confidence: opp.confidence,
        entryRationale: opp.entryRationale,
        outcome: reflectionOutcome,
        realizedPL,
        managementLog,
        technicalSnapshot: safeParseSnapshot(opp.technicalSnapshot),
      }

      const prompt = buildReflectionPrompt(ctx)
      const anthropic = new Anthropic({ apiKey })

      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 500,
        system: [
          {
            type: "text" as const,
            text: prompt.system,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: prompt.user }],
      })

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const cost = getModelCost(this.model, inputTokens, outputTokens)

      let result: { reflection: string; lessonsLearned: string }
      try {
        result = extractJSON(text)
      } catch {
        console.warn(
          `[reflection] Invalid JSON from reflection for ${opp.instrument}: ${text.slice(0, 200)}`,
        )
        return
      }

      await createReflection({
        opportunityId: opp.id,
        instrument: opp.instrument,
        direction: opp.direction,
        profile: opp.profile,
        confidence: opp.confidence,
        outcome: reflectionOutcome,
        realizedPL,
        entryRationale: opp.entryRationale,
        reflection: result.reflection,
        lessonsLearned: result.lessonsLearned,
        primaryTechnique: opp.primaryTechnique,
        regime: opp.regime,
        session: opp.session,
        model: this.model,
        inputTokens,
        outputTokens,
        cost,
        closedAt: new Date(),
      })

      console.log(
        `[reflection] Generated reflection for ${opp.instrument} ${opp.direction} (${outcome}, $${realizedPL.toFixed(2)})`,
      )
    } catch (err) {
      // Fire-and-forget: log and swallow
      console.error(
        `[reflection] Failed to generate reflection for ${opp.id}:`,
        (err as Error).message,
      )
    }
  }
}
