/**
 * Multi-agent analysis orchestrator for EdgeFinder.
 *
 * Implements the debate-based decision pipeline inspired by TradingAgents:
 *   1. Technical Brief (Haiku, parallel) + Macro/Risk Brief (Haiku, parallel)
 *   2. Bull Case (Haiku, sequential — sees briefs)
 *   3. Bear Case (Haiku, sequential — sees briefs + bull argument)
 *   4. Judge (Sonnet — weighs briefs + debate + past reflections → final decision)
 *
 * @module multi-agent
 */
import type Anthropic from "@anthropic-ai/sdk"
import type {
  AiTraderConfigData,
  AiTraderStrategyPerformanceData,
  AiTraderReflectionData,
  AiTraderScanLogEntry,
  EconomicCalendarEvent,
  NewsSentimentData,
} from "@fxflow/types"
import { AI_MODEL_OPTIONS } from "@fxflow/types"
import { getRelevantReflections } from "@fxflow/db"
import type { Tier1Signal } from "./strategy-engine.js"
import {
  buildTechnicalBriefPrompt,
  buildMacroRiskBriefPrompt,
  buildBullCasePrompt,
  buildBearCasePrompt,
  buildJudgePrompt,
  type Tier3Context,
  type JudgeContext,
} from "./prompt-builder.js"
import type { CostTracker } from "./cost-tracker.js"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MultiAgentInput {
  signal: Tier1Signal
  tier2Response: string
  fundamentalData: {
    calendar: EconomicCalendarEvent[]
    sentiment: Record<string, NewsSentimentData | null>
    macro: Record<string, unknown>
  }
  performanceHistory: AiTraderStrategyPerformanceData[]
  config: AiTraderConfigData
  accountBalance: number
  openTradeCount: number
  riskPercent: number
  consecutiveLosses: number
  pairProfileWinRate: number | null
}

export interface MultiAgentResult {
  // Debate data
  technicalBrief: string
  macroRiskBrief: string
  bullCase: string
  bearCase: string
  reflections: AiTraderReflectionData[]
  // Costs
  debateCost: number
  debateInputTokens: number
  debateOutputTokens: number
  // Judge result (same shape as Tier 3)
  judgeResponse: string
  judgeModel: string
  judgeInputTokens: number
  judgeOutputTokens: number
  judgeCost: number
}

type LogFn = (
  type: AiTraderScanLogEntry["type"],
  message: string,
  detail?: string,
  metadata?: AiTraderScanLogEntry["metadata"],
) => void

// ─── Helpers ────────────────────────────────────────────────────────────────

function getModelCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = AI_MODEL_OPTIONS.find((m) => modelId.includes(m.id) || m.id.includes(modelId))
  const inputCost = model?.inputCostPer1M ?? 3
  const outputCost = model?.outputCostPer1M ?? 15
  return (inputTokens * inputCost + outputTokens * outputCost) / 1_000_000
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
}

function getUsage(response: Anthropic.Message): { input: number; output: number } {
  return { input: response.usage.input_tokens, output: response.usage.output_tokens }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export class MultiAgentAnalyzer {
  constructor(
    private costTracker: CostTracker,
    private addLogEntry: LogFn,
  ) {}

  async analyze(anthropic: Anthropic, input: MultiAgentInput): Promise<MultiAgentResult> {
    const {
      signal,
      tier2Response,
      fundamentalData,
      performanceHistory,
      config,
      accountBalance,
      openTradeCount,
      riskPercent,
      consecutiveLosses,
      pairProfileWinRate,
    } = input

    const pairLabel = signal.instrument.replace("_", "/")
    const scanModel = config.scanModel || "claude-haiku-4-5-20251001"
    const decisionModel = config.decisionModel || "claude-sonnet-4-6"

    let totalDebateInput = 0
    let totalDebateOutput = 0
    let totalDebateCost = 0

    // ── Step 1: Analyst Briefs (parallel) ────────────────────────────────

    const techBriefPrompt = buildTechnicalBriefPrompt(signal)
    const macroBriefPrompt = buildMacroRiskBriefPrompt(
      signal,
      fundamentalData,
      performanceHistory,
      accountBalance,
      openTradeCount,
      config.maxConcurrentTrades,
      consecutiveLosses,
      pairProfileWinRate,
    )

    const [techBriefRes, macroBriefRes] = await Promise.all([
      anthropic.messages.create({
        model: scanModel,
        max_tokens: 400,
        system: [
          {
            type: "text" as const,
            text: techBriefPrompt.system,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: techBriefPrompt.user }],
      }),
      anthropic.messages.create({
        model: scanModel,
        max_tokens: 400,
        system: [
          {
            type: "text" as const,
            text: macroBriefPrompt.system,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: macroBriefPrompt.user }],
      }),
    ])

    const technicalBrief = extractText(techBriefRes)
    const macroRiskBrief = extractText(macroBriefRes)

    const techUsage = getUsage(techBriefRes)
    const macroUsage = getUsage(macroBriefRes)
    totalDebateInput += techUsage.input + macroUsage.input
    totalDebateOutput += techUsage.output + macroUsage.output
    totalDebateCost += getModelCost(scanModel, techUsage.input, techUsage.output)
    totalDebateCost += getModelCost(scanModel, macroUsage.input, macroUsage.output)

    this.addLogEntry("brief_complete", `${pairLabel}: Analyst briefs generated`, undefined, {
      instrument: signal.instrument,
      direction: signal.direction,
      profile: signal.profile,
    })

    // ── Step 2: Bull Case (sequential — needs briefs) ────────────────────

    const bullPrompt = buildBullCasePrompt(signal, technicalBrief, macroRiskBrief)
    const bullRes = await anthropic.messages.create({
      model: scanModel,
      max_tokens: 500,
      system: [
        {
          type: "text" as const,
          text: bullPrompt.system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: bullPrompt.user }],
    })

    const bullCaseText = extractText(bullRes)
    const bullUsage = getUsage(bullRes)
    totalDebateInput += bullUsage.input
    totalDebateOutput += bullUsage.output
    totalDebateCost += getModelCost(scanModel, bullUsage.input, bullUsage.output)

    this.addLogEntry(
      "bull_case",
      `${pairLabel}: Bull case — ${bullCaseText.slice(0, 80)}...`,
      bullCaseText,
      {
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
      },
    )

    // ── Step 3: Bear Case (sequential — needs briefs + bull) ─────────────

    const bearPrompt = buildBearCasePrompt(signal, technicalBrief, macroRiskBrief, bullCaseText)
    const bearRes = await anthropic.messages.create({
      model: scanModel,
      max_tokens: 500,
      system: [
        {
          type: "text" as const,
          text: bearPrompt.system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: bearPrompt.user }],
    })

    const bearCaseText = extractText(bearRes)
    const bearUsage = getUsage(bearRes)
    totalDebateInput += bearUsage.input
    totalDebateOutput += bearUsage.output
    totalDebateCost += getModelCost(scanModel, bearUsage.input, bearUsage.output)

    this.addLogEntry(
      "bear_case",
      `${pairLabel}: Bear case — ${bearCaseText.slice(0, 80)}...`,
      bearCaseText,
      {
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
      },
    )

    this.costTracker.invalidateCache()

    // ── Step 4: Retrieve Past Reflections ────────────────────────────────

    const reflections = await getRelevantReflections(signal.instrument, signal.profile, 3)

    // ── Step 5: Judge Decision (Sonnet) ──────────────────────────────────

    const tier3Ctx: Tier3Context = {
      signal,
      tier2Response,
      fundamentalData,
      performanceHistory,
      config,
      accountBalance,
      openTradeCount,
      riskPercent,
      consecutiveLosses,
      pairProfileWinRate,
    }

    const judgeCtx: JudgeContext = {
      ...tier3Ctx,
      technicalBrief,
      macroRiskBrief,
      bullCase: bullCaseText,
      bearCase: bearCaseText,
      reflections,
    }

    const judgePrompt = buildJudgePrompt(judgeCtx)
    const judgeRes = await anthropic.messages.create({
      model: decisionModel,
      max_tokens: 1500,
      system: [
        {
          type: "text" as const,
          text: judgePrompt.system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: judgePrompt.user }],
    })

    const judgeText = extractText(judgeRes)
    const judgeUsage = getUsage(judgeRes)
    const judgeCost = getModelCost(decisionModel, judgeUsage.input, judgeUsage.output)

    this.costTracker.invalidateCache()

    return {
      technicalBrief,
      macroRiskBrief,
      bullCase: bullCaseText,
      bearCase: bearCaseText,
      reflections,
      debateCost: totalDebateCost,
      debateInputTokens: totalDebateInput,
      debateOutputTokens: totalDebateOutput,
      judgeResponse: judgeText,
      judgeModel: decisionModel,
      judgeInputTokens: judgeUsage.input,
      judgeOutputTokens: judgeUsage.output,
      judgeCost,
    }
  }
}
