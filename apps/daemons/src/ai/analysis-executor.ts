import Anthropic from "@anthropic-ai/sdk"
import type {
  AiAnalysisDepth,
  AiClaudeModel,
  AiAnalysisSections,
  AiAnalysisTriggeredBy,
  AnyDaemonMessage,
  TradeConditionTriggerType,
  TradeConditionActionType,
} from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { ConditionMonitor } from "./condition-monitor.js"
import { gatherTradeContext, type TradeContextSnapshot } from "./context-gatherer.js"

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert professional Forex trader with over 20 years of experience specializing in identifying high-probability trade setups and providing world-class trade analysis. You have deep expertise in:

- Technical analysis (price action, S/R levels, candlestick patterns, momentum)
- Fundamental analysis (economic events, central bank policy, market sentiment)
- Risk management (position sizing, R:R optimization, drawdown control)
- Trade management (scaling, partial closes, trailing stops, breakeven)

Your analysis must be:
1. SPECIFIC: Use exact price levels, not vague ranges
2. HONEST: Give realistic probability assessments — never inflate confidence
3. ACTIONABLE: Every recommendation must have a clear, executable next step
4. ACCESSIBLE: Written so clearly that a complete beginner can understand it
5. PROFESSIONAL: With the depth that satisfies experienced traders

LANGUAGE RULES (CRITICAL — apply to every text field):
- Write every sentence as if explaining to someone who has never traded before
- Avoid ALL jargon: instead of "RSI overbought" say "the price has risen too fast and may start to slow down or reverse"; instead of "bullish divergence" say "price is falling but momentum is picking up — a sign the market might reverse upward"; instead of "S/R confluence" say "there's a strong price level where buyers or sellers have stepped in multiple times before"
- Spell out abbreviations on first use (e.g. "RSI (a momentum indicator that measures how fast price is moving)")
- Numbers must be explained in plain terms: not just "RR: 1.5" but "for every $1 you risk, you could potentially make $1.50"
- The summary field MUST be understandable to a 13-year-old with zero forex knowledge — if they couldn't understand it, rewrite it
- Use active, direct sentences: "Price is likely to rise" not "Bullish bias expected"
- When describing a risk factor, explain WHY it matters: "There's a big news event (US jobs report) coming in 2 hours — this can cause sudden large price moves that hit stop-losses"

The \`tldr\` field is the MOST IMPORTANT field. It must contain a single clear action that a complete beginner could follow immediately. Examples: "Your trade is doing well — keep holding and let it run to your target." or "Close this trade now — price is moving against you and there's a big news event in 30 minutes." The sentence should be understandable by a 13-year-old with zero forex knowledge.

Score the alignment of M15, H1, and H4 trends. Strong alignment (all same direction) = higher score. Conflicting signals = lower score and explicit warning.

Rate the entry quality. A great entry is at a key level with confluence. A poor entry is mid-range with no clear level. Be honest — this helps the user learn.

Check for correlated exposure. If multiple positions are betting the same direction on correlated pairs (e.g., long EUR/USD and long GBP/USD = double-short USD), flag the concentrated risk.

CRITICAL: You MUST respond with ONLY a valid JSON object that exactly matches this TypeScript interface. No markdown, no explanation text outside the JSON:

{
  "tldr": {
    "action": "hold" | "close" | "adjust" | "reduce" | "watch" | "exit_now",
    "sentence": "One clear sentence a complete beginner could follow immediately",
    "urgency": "now" | "soon" | "monitor"
  },
  "summary": "string (2-3 sentence executive summary)",
  "winProbability": number (0-100, be honest and realistic),
  "tradeQualityScore": number (0-10, 1 decimal place),
  "technical": {
    "trend": "string (current trend description with timeframe context)",
    "keyLevels": [{ "price": number, "label": "string", "type": "support" | "resistance" | "pivot" }],
    "indicators": "string (RSI, EMA, ATR readings and what they mean)",
    "candlePatterns": "string (recent notable patterns)",
    "momentum": "string (momentum assessment)"
  },
  "risk": {
    "assessment": "low" | "medium" | "high" | "very_high",
    "factors": ["string array of specific risk factors"],
    "riskRewardAnalysis": "string (actual R:R calculation with explanation)",
    "positionSizingComment": "string (is position size appropriate?)"
  },
  "marketContext": {
    "currentSession": "string",
    "volatility": "string (ATR-based volatility assessment)",
    "newsEvents": [{ "title": "string", "time": "string", "currency": "string", "impact": "low"|"medium"|"high", "forecast": "string|null", "previous": "string|null" }],
    "correlations": "string (correlated pairs and what they suggest)",
    "sentimentNote": "string (overall market sentiment for this pair)"
  },
  "tradeHistory": {
    "pairWinRate": "string (X% win rate over Y trades)",
    "averageRR": "string",
    "commonPatterns": "string (what tends to work / fail for this pair)",
    "recentPerformance": "string (last few trade outcomes)"
  },
  "confluenceScore": {
    "m15Trend": "bullish" | "bearish" | "sideways",
    "h1Trend": "bullish" | "bearish" | "sideways",
    "h4Trend": "bullish" | "bearish" | "sideways",
    "alignment": "strong" | "moderate" | "weak" | "conflicting",
    "score": "1-10",
    "explanation": "Brief explanation of timeframe alignment"
  },
  "entryQuality": {
    "score": "1-10",
    "levelType": "at support | at resistance | mid-range | at key level | etc.",
    "distanceFromKey": "X pips from nearest support/resistance",
    "timingNote": "entry timing assessment",
    "improvements": "how entry could have been better"
  },
  "portfolioRisk": {
    "correlatedExposure": "description of correlated exposure or null",
    "totalRiskPercent": "estimated total portfolio risk",
    "concentrationWarning": "warning if concentrated risk or null"
  },
  "recommendations": ["string array — numbered, specific, actionable"],
  "immediateActions": [
    {
      "id": "string (unique)",
      "type": "adjust_sl" | "adjust_tp" | "adjust_entry" | "partial_close" | "close_trade" | "cancel_order" | "update_expiry" | "move_to_breakeven",
      "label": "string (short button label, max 30 chars)",
      "description": "string (what this will do, max 80 chars)",
      "params": { object with relevant fields like "stopLoss", "takeProfit", "units", "price", "entryPrice", "expiry" (ISO 8601 datetime) etc },
      "confidence": "high" | "medium" | "low",
      "rationale": "string (why this action is recommended)"
    }
  ],
  "conditionSuggestions": [
    {
      "label": "string",
      "triggerType": "price_reaches" | "price_breaks_above" | "price_breaks_below" | "pnl_pips" | "pnl_currency" | "time_reached" | "duration_hours" | "trailing_stop",
      "triggerValue": { object },
      "actionType": "close_trade" | "partial_close" | "move_stop_loss" | "move_take_profit" | "cancel_order" | "notify",
      "actionParams": { object },
      "confidence": "high" | "medium" | "low",
      "rationale": "string"
    }
  ],
  "postMortem": "string | null (only for CLOSED trades: honest assessment of what went right/wrong)"
}

For CLOSED trades: set immediateActions to [] and provide a detailed postMortem.
For PENDING/OPEN trades: postMortem should be null.

IMPORTANT rules for immediateActions vs conditionSuggestions:
- immediateActions are ONE-TIME modifications applied instantly (move SL, move TP, close trade, adjust entry price, set expiry, etc.)
- Do NOT use immediateActions for conditional/automated rules — use conditionSuggestions instead
- If you want to suggest a condition (e.g. "close if price hits X", "move SL when Y happens"), put it in conditionSuggestions, NOT as an immediateAction
- For "adjust_entry", include params.entryPrice (number) — only works on PENDING orders
- For "update_expiry", include params.hours (number of hours from now) OR params.expiry (ISO 8601 datetime string) — only works on PENDING orders
- NEVER use "adjust_tp_partial" as an immediateAction type. "Take partial profits at price X" is a CONDITIONAL rule, not an instant action. Put it in conditionSuggestions instead with triggerType "price_breaks_above" (long) or "price_breaks_below" (short), actionType "partial_close", and actionParams { units: N }.
- For trailing stop suggestions, use triggerType "trailing_stop" with triggerValue { distance_pips: number, step_pips?: number }. The distance_pips is the trailing distance from the current price, and step_pips (optional) is the minimum step size for the trailing stop to move.`

// ─── Progress Stages ─────────────────────────────────────────────────────────

interface ProgressStage {
  label: string
  progress: number
}

const STAGES: ProgressStage[] = [
  { label: "Gathering trade details...", progress: 5 },
  { label: "Loading account context...", progress: 15 },
  { label: "Fetching market candles...", progress: 30 },
  { label: "Calculating technical indicators...", progress: 45 },
  { label: "Loading trade history...", progress: 55 },
  { label: "Fetching economic calendar...", progress: 65 },
  { label: "Querying market news...", progress: 72 },
  { label: "Preparing analysis context...", progress: 80 },
  { label: "Claude is analyzing your trade...", progress: 85 },
]

// ─── In-progress tracking ─────────────────────────────────────────────────────

const activeControllers = new Map<string, AbortController>()

export function cancelActiveAnalysis(analysisId: string): void {
  const controller = activeControllers.get(analysisId)
  if (controller) {
    controller.abort()
    activeControllers.delete(analysisId)
  }
}

/** Cancel every in-flight analysis and return the count aborted. */
export function cancelAllActiveAnalyses(): number {
  const count = activeControllers.size
  for (const [id, controller] of activeControllers) {
    controller.abort()
    activeControllers.delete(id)
  }
  return count
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

/**
 * Robustly extract a JSON object from a Claude response.
 * Handles: raw JSON, code-fenced JSON, preamble/trailing text around JSON,
 * and truncated responses (attempts to close open braces).
 */
function extractJsonFromResponse<T>(raw: string): T {
  const trimmed = raw.trim()

  // 1. Strip code fences if present
  const fenceStripped = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "")
    : trimmed

  // 2. Try direct parse first (happy path)
  try {
    return JSON.parse(fenceStripped) as T
  } catch {
    // continue to more robust extraction
  }

  // 3. Extract JSON by finding first '{' and last '}'
  const firstBrace = fenceStripped.indexOf("{")
  const lastBrace = fenceStripped.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = fenceStripped.slice(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(extracted) as T
    } catch {
      // continue to truncation repair
    }
  }

  // 4. Handle truncated JSON (response cut off by max_tokens)
  // Find the first '{' and try to close unclosed braces/brackets
  if (firstBrace !== -1) {
    let candidate = fenceStripped.slice(firstBrace)
    // Remove any trailing incomplete string (e.g., `"text that was cut o`)
    candidate = candidate.replace(/,?\s*"[^"]*$/, "")
    // Remove trailing comma if present
    candidate = candidate.replace(/,\s*$/, "")
    // Count unclosed braces and brackets
    let openBraces = 0
    let openBrackets = 0
    let inString = false
    let escaped = false
    for (const ch of candidate) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === "{") openBraces++
      else if (ch === "}") openBraces--
      else if (ch === "[") openBrackets++
      else if (ch === "]") openBrackets--
    }
    // Close any open brackets then braces
    candidate += "]".repeat(Math.max(0, openBrackets))
    candidate += "}".repeat(Math.max(0, openBraces))
    try {
      return JSON.parse(candidate) as T
    } catch {
      // final fallback failed
    }
  }

  throw new Error(`Could not extract valid JSON from response (length=${raw.length})`)
}

// ─── Main Executor ───────────────────────────────────────────────────────────

export async function executeAnalysis(opts: {
  analysisId: string
  tradeId: string
  depth: AiAnalysisDepth
  model: AiClaudeModel
  tradeStatus: string
  triggeredBy: AiAnalysisTriggeredBy
  stateManager: StateManager
  tradeSyncer: OandaTradeSyncer
  broadcast: (msg: AnyDaemonMessage) => void
  conditionMonitor?: ConditionMonitor | null
}): Promise<void> {
  const {
    analysisId,
    tradeId,
    depth,
    model,
    tradeStatus,
    triggeredBy,
    stateManager,
    tradeSyncer,
    broadcast,
    conditionMonitor,
  } = opts

  const { updateAnalysisStatus, saveAnalysisResult, getDecryptedClaudeKey, createNotification } =
    await import("@fxflow/db")

  const startTime = Date.now()
  const controller = new AbortController()
  activeControllers.set(analysisId, controller)

  function sendProgress(stage: string, progress: number) {
    broadcast({
      type: "ai_analysis_update",
      timestamp: new Date().toISOString(),
      data: { analysisId, tradeId, stage, progress },
    })
  }

  function sendChunk(chunk: string) {
    broadcast({
      type: "ai_analysis_update",
      timestamp: new Date().toISOString(),
      data: { analysisId, tradeId, chunk },
    })
  }

  try {
    await updateAnalysisStatus(analysisId, "running")

    broadcast({
      type: "ai_analysis_started",
      timestamp: new Date().toISOString(),
      data: { analysisId, tradeId, model, depth },
    })

    // ─── Gather context ────────────────────────────────────────────────
    sendProgress(STAGES[0]!.label, STAGES[0]!.progress)

    let context: TradeContextSnapshot
    try {
      for (let i = 1; i < STAGES.length - 1; i++) {
        sendProgress(STAGES[i]!.label, STAGES[i]!.progress)
        if (i === 2) await new Promise((r) => setTimeout(r, 50)) // tiny delay for UX
      }
      context = await gatherTradeContext({ tradeId, depth, stateManager, tradeSyncer })
    } catch (err) {
      throw new Error(`Context gathering failed: ${(err as Error).message}`)
    }

    sendProgress(STAGES[8]!.label, STAGES[8]!.progress)

    // ─── Get Claude API key ────────────────────────────────────────────
    const apiKey = await getDecryptedClaudeKey()
    if (!apiKey)
      throw new Error("Claude API key not configured. Please add it in Settings > AI & Claude.")

    const anthropic = new Anthropic({ apiKey })

    // ─── Build user message ────────────────────────────────────────────
    const userMessage = buildUserMessage(context, depth)

    // ─── Learning mode check ──────────────────────────────────────────
    const { getAiSettings: getSettings } = await import("@fxflow/db")
    const currentAiSettings = await getSettings()
    let systemPrompt = SYSTEM_PROMPT
    if (currentAiSettings.autoAnalysis.learningMode) {
      systemPrompt += `\n\nLEARNING MODE ACTIVE: For each analysis section (technical, risk, marketContext, tradeHistory), add an "educational" sub-field (string, 2-3 sentences) that teaches the user the concept behind your analysis. Use analogies a teenager would understand. Example: For RSI, explain "RSI is like a speedometer for price — when it's above 70, the price has been running too fast and might need to slow down."`
    }

    // ─── Max tokens by depth ───────────────────────────────────────────
    // The AiAnalysisSections interface requires ~2000+ tokens minimum.
    // Previous limits (1500/3000/6000) caused truncation & parse failures.
    const maxTokens: Record<AiAnalysisDepth, number> = {
      quick: 3000,
      standard: 6000,
      deep: 10000,
    }

    // ─── Stream from Claude (with 3-minute timeout) ────────────────────
    const STREAM_TIMEOUT_MS = 180_000 // 3 minutes
    let rawResponse = ""
    let inputTokens = 0
    let outputTokens = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamOpts: any = {
      model,
      max_tokens: depth === "deep" ? 16000 : maxTokens[depth],
      system: systemPrompt,
      messages: [{ role: "user" as const, content: userMessage }],
    }

    // Enable extended thinking for deep analysis (non-haiku models)
    if (depth === "deep" && !model.includes("haiku")) {
      streamOpts.thinking = { type: "enabled", budget_tokens: 8000 }
    }

    const stream = anthropic.messages.stream(streamOpts)

    // Set a timeout that aborts the stream if it takes too long
    const streamTimeout = setTimeout(() => {
      if (!controller.signal.aborted) {
        console.warn(
          `[ai-executor] Analysis ${analysisId} timed out after ${STREAM_TIMEOUT_MS / 1000}s`,
        )
        controller.abort()
      }
    }, STREAM_TIMEOUT_MS)

    try {
      for await (const event of stream) {
        if (controller.signal.aborted) {
          stream.abort()
          // Distinguish timeout from user cancellation
          const isTimeout = rawResponse.length > 0
          await updateAnalysisStatus(
            analysisId,
            isTimeout ? "failed" : "cancelled",
            isTimeout ? `Analysis timed out after ${STREAM_TIMEOUT_MS / 1000} seconds` : undefined,
          )
          activeControllers.delete(analysisId)
          return
        }

        // Skip thinking content blocks — they improve analysis quality but aren't part of the output
        if (
          event.type === "content_block_start" &&
          (event.content_block as { type: string }).type === "thinking"
        ) {
          continue
        }
        if (
          event.type === "content_block_delta" &&
          (event.delta as { type: string }).type === "thinking_delta"
        ) {
          continue
        }

        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          rawResponse += event.delta.text
          sendChunk(event.delta.text)
          // Update progress as tokens stream in (85 → 98)
          const approxProgress = Math.min(98, 85 + Math.floor(rawResponse.length / 100))
          sendProgress("Claude is analyzing your trade...", approxProgress)
        } else if (event.type === "message_delta" && event.usage) {
          outputTokens = event.usage.output_tokens
        } else if (event.type === "message_start" && event.message.usage) {
          inputTokens = event.message.usage.input_tokens
        }
      }
    } finally {
      clearTimeout(streamTimeout)
    }

    // ─── Parse JSON response ───────────────────────────────────────────
    let sections: AiAnalysisSections | null = null
    try {
      sections = extractJsonFromResponse<AiAnalysisSections>(rawResponse)
    } catch (parseErr) {
      console.error("[ai-executor] Failed to parse JSON response:", (parseErr as Error).message)
      console.error("[ai-executor] Raw response (first 500 chars):", rawResponse.slice(0, 500))
      console.error("[ai-executor] Raw response (last 200 chars):", rawResponse.slice(-200))
    }

    const durationMs = Date.now() - startTime

    // ─── Handle parse failure ──────────────────────────────────────────
    if (!sections) {
      const parseError = "Failed to parse analysis results from AI response"
      await updateAnalysisStatus(analysisId, "failed", parseError)

      broadcast({
        type: "ai_analysis_completed",
        timestamp: new Date().toISOString(),
        data: {
          analysisId,
          tradeId,
          sections: null,
          inputTokens,
          outputTokens,
          costUsd: 0,
          durationMs,
          error: parseError,
        },
      })

      sendProgress("Analysis complete!", 100)

      const pairLabel = context.trade.instrument.replace("_", "/")
      await createNotification({
        severity: "warning",
        source: "ai_analysis",
        title: "AI Analysis — Parse Error",
        message: `${pairLabel} ${context.trade.direction} — Analysis completed but results couldn't be processed. Try again.`,
        metadata: { analysisId, tradeId },
      })
      return
    }

    // ─── Save result ───────────────────────────────────────────────────
    await saveAnalysisResult(analysisId, {
      rawResponse,
      sections,
      inputTokens,
      outputTokens,
      durationMs,
    })

    // ─── Create recommendation outcome for accuracy tracking ──────────
    if (sections.tldr && sections.winProbability != null) {
      try {
        const { createRecommendationOutcome } = await import("@fxflow/db")
        await createRecommendationOutcome({
          analysisId,
          tradeId,
          recommendedAction: sections.tldr.action,
          winProbability: sections.winProbability / 100, // Convert 0-100 to 0-1
          qualityScore: sections.tradeQualityScore ?? 5,
        })
      } catch (recErr) {
        console.warn(
          "[ai-executor] Failed to create recommendation outcome:",
          (recErr as Error).message,
        )
      }
    }

    // ─── Auto-apply condition suggestions ─────────────────────────────
    if (sections.conditionSuggestions?.length && tradeStatus !== "closed") {
      try {
        const { getAiSettings, createCondition, listConditionsForTrade } =
          await import("@fxflow/db")
        const aiSettings = await getAiSettings()
        if (aiSettings.autoAnalysis.autoApplyConditions) {
          const minCondConf = aiSettings.autoAnalysis.autoApplyMinConditionConfidence ?? "medium"
          const condConfRank: Record<string, number> = { high: 3, medium: 2, low: 1 }
          const minCondRank = condConfRank[minCondConf] ?? 2

          // Fetch existing conditions to prevent duplicates
          const existing = await listConditionsForTrade(tradeId)
          const activeConditions = existing.filter((c) => c.status === "active")

          console.log(
            `[ai-executor] Auto-applying conditions for trade ${tradeId} (${sections.conditionSuggestions.length} suggested, ${activeConditions.length} already active, minConfidence: ${minCondConf})`,
          )
          for (const suggestion of sections.conditionSuggestions) {
            // Filter by confidence threshold
            const suggestionConf = suggestion.confidence ?? "medium" // default to medium if AI omits
            const suggestionRank = condConfRank[suggestionConf] ?? 2
            if (suggestionRank < minCondRank) {
              console.log(
                `[ai-executor] Skipping low-confidence condition: ${suggestion.label} (${suggestionConf} < ${minCondConf})`,
              )
              continue
            }

            // Dedup: skip if an active condition with same trigger+action+params already exists.
            // Compare by parameter values (not label) since AI may generate different labels
            // for functionally identical conditions.
            const sugTriggerJSON = JSON.stringify(suggestion.triggerValue)
            const sugActionJSON = JSON.stringify(suggestion.actionParams ?? {})
            const isDuplicate = activeConditions.some(
              (c) =>
                c.triggerType === suggestion.triggerType &&
                c.actionType === suggestion.actionType &&
                JSON.stringify(c.triggerValue) === sugTriggerJSON &&
                JSON.stringify(c.actionParams ?? {}) === sugActionJSON,
            )
            if (isDuplicate) {
              console.log(`[ai-executor] Skipping duplicate condition: ${suggestion.label}`)
              continue
            }
            try {
              // AI-created conditions expire after 7 days to prevent stale conditions
              // from executing inappropriate actions if market conditions change
              const AI_CONDITION_EXPIRY_DAYS = 7
              const expiresAt = new Date(Date.now() + AI_CONDITION_EXPIRY_DAYS * 86_400_000)

              const condition = await createCondition({
                tradeId,
                triggerType: suggestion.triggerType as TradeConditionTriggerType,
                triggerValue: suggestion.triggerValue,
                actionType: suggestion.actionType as TradeConditionActionType,
                actionParams: suggestion.actionParams,
                label: suggestion.label,
                createdBy: "ai",
                analysisId,
                expiresAt,
              })
              if (conditionMonitor) {
                await conditionMonitor.reloadCondition(condition.id)
              }
              console.log(
                `[ai-executor] Auto-applied condition: ${suggestion.label} (${condition.id})`,
              )
            } catch (condErr) {
              console.warn(
                `[ai-executor] Failed to auto-apply condition "${suggestion.label}":`,
                (condErr as Error).message,
              )
            }
          }
        }
      } catch (settingsErr) {
        console.warn(
          "[ai-executor] Failed to check auto-apply settings:",
          (settingsErr as Error).message,
        )
      }
    }

    // ─── Auto-apply immediate actions ────────────────────────────────
    if (sections.immediateActions?.length && tradeStatus !== "closed") {
      try {
        const { getAiSettings, db } = await import("@fxflow/db")
        const aiSettings = await getAiSettings()
        const tradingMode = stateManager.getSnapshot().tradingMode ?? "practice"
        const autoApplyEnabled =
          tradingMode === "live"
            ? aiSettings.autoAnalysis.liveAutoApplyEnabled
            : aiSettings.autoAnalysis.practiceAutoApplyEnabled

        if (autoApplyEnabled) {
          const minConf = aiSettings.autoAnalysis.autoApplyMinConfidence ?? "high"
          const confRank: Record<string, number> = { high: 3, medium: 2, low: 1 }
          const minRank = confRank[minConf] ?? 3

          // Get sourceTradeId for OANDA API calls
          const trade = await db.trade.findUnique({
            where: { id: tradeId },
            select: {
              sourceTradeId: true,
              entryPrice: true,
              status: true,
              direction: true,
              currentUnits: true,
            },
          })

          if (trade) {
            const appliedIds: string[] = []
            let tradeClosed = false

            for (const action of sections.immediateActions) {
              if (tradeClosed) break
              const actionRank = confRank[action.confidence] ?? 0 // undefined confidence = skip (never auto-apply)
              if (actionRank < minRank) continue

              try {
                switch (action.type) {
                  case "adjust_sl": {
                    const sl = (action.params.stopLoss ?? action.params.price) as number | undefined
                    if (sl) {
                      if (trade.status === "open")
                        await tradeSyncer.modifyTradeSLTP(trade.sourceTradeId, sl, undefined)
                      else if (trade.status === "pending")
                        await tradeSyncer.modifyPendingOrderSLTP(trade.sourceTradeId, sl, undefined)
                      appliedIds.push(action.id)
                      console.log(
                        `[ai-executor] Auto-applied action: ${action.label} (adjust_sl → ${sl})`,
                      )
                    }
                    break
                  }
                  case "move_to_breakeven": {
                    const sl = trade.entryPrice
                    if (trade.status === "open")
                      await tradeSyncer.modifyTradeSLTP(trade.sourceTradeId, sl, undefined)
                    else if (trade.status === "pending")
                      await tradeSyncer.modifyPendingOrderSLTP(trade.sourceTradeId, sl, undefined)
                    appliedIds.push(action.id)
                    console.log(
                      `[ai-executor] Auto-applied action: ${action.label} (move_to_breakeven → ${sl})`,
                    )
                    break
                  }
                  case "adjust_tp": {
                    const tp = (action.params.takeProfit ?? action.params.price) as
                      | number
                      | undefined
                    if (tp) {
                      if (trade.status === "open")
                        await tradeSyncer.modifyTradeSLTP(trade.sourceTradeId, undefined, tp)
                      else if (trade.status === "pending")
                        await tradeSyncer.modifyPendingOrderSLTP(trade.sourceTradeId, undefined, tp)
                      appliedIds.push(action.id)
                      console.log(
                        `[ai-executor] Auto-applied action: ${action.label} (adjust_tp → ${tp})`,
                      )
                    }
                    break
                  }
                  case "close_trade": {
                    await tradeSyncer.closeTrade(
                      trade.sourceTradeId,
                      undefined,
                      `AI auto-applied: ${action.label}`,
                    )
                    appliedIds.push(action.id)
                    tradeClosed = true
                    console.log(`[ai-executor] Auto-applied action: ${action.label} (close_trade)`)
                    break
                  }
                  case "partial_close": {
                    const units = action.params.units as number | undefined
                    if (units) {
                      await tradeSyncer.closeTrade(
                        trade.sourceTradeId,
                        units,
                        `AI auto-applied: ${action.label}`,
                      )
                      appliedIds.push(action.id)
                      console.log(
                        `[ai-executor] Auto-applied action: ${action.label} (partial_close ${units} units)`,
                      )
                    }
                    break
                  }
                  case "cancel_order": {
                    if (trade.status === "pending") {
                      await tradeSyncer.cancelOrder(
                        trade.sourceTradeId,
                        `AI auto-applied: ${action.label}`,
                      )
                      appliedIds.push(action.id)
                      tradeClosed = true
                      console.log(
                        `[ai-executor] Auto-applied action: ${action.label} (cancel_order)`,
                      )
                    }
                    break
                  }
                  case "adjust_entry": {
                    const entryPrice = (action.params.entryPrice ?? action.params.price) as
                      | number
                      | undefined
                    if (entryPrice && trade.status === "pending") {
                      await tradeSyncer.modifyPendingOrderSLTP(
                        trade.sourceTradeId,
                        undefined,
                        undefined,
                        entryPrice,
                      )
                      appliedIds.push(action.id)
                      console.log(
                        `[ai-executor] Auto-applied action: ${action.label} (adjust_entry → ${entryPrice})`,
                      )
                    }
                    break
                  }
                  case "update_expiry": {
                    const expiryRaw = (action.params.expiry ??
                      action.params.gtdTime ??
                      action.params.expiryTime) as string | undefined
                    const expiryHours = (action.params.hours ?? action.params.durationHours) as
                      | number
                      | undefined
                    let gtdTime: string | null = null
                    if (expiryRaw) gtdTime = new Date(expiryRaw).toISOString()
                    else if (expiryHours && expiryHours > 0)
                      gtdTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
                    if (gtdTime && trade.status === "pending") {
                      await tradeSyncer.modifyPendingOrderSLTP(
                        trade.sourceTradeId,
                        undefined,
                        undefined,
                        undefined,
                        gtdTime,
                      )
                      appliedIds.push(action.id)
                      console.log(
                        `[ai-executor] Auto-applied action: ${action.label} (update_expiry → ${gtdTime})`,
                      )
                    }
                    break
                  }
                  case "adjust_tp_partial": {
                    // Legacy: older analyses may have this as an action. Create a condition instead.
                    const tpPrice = (action.params.price ??
                      action.params.takeProfit ??
                      action.params.targetPrice ??
                      action.params.target ??
                      action.params.partialTakeProfit) as number | undefined
                    if (tpPrice && trade.status === "open") {
                      const { createCondition: createCond } = await import("@fxflow/db")
                      const direction =
                        trade.direction === "long" ? "price_breaks_above" : "price_breaks_below"
                      const units =
                        ((action.params.units ?? action.params.unitsToClose) as
                          | number
                          | undefined) ??
                        (action.params.percentage
                          ? Math.round(
                              trade.currentUnits * ((action.params.percentage as number) / 100),
                            )
                          : undefined) ??
                        Math.round(trade.currentUnits / 2)
                      await createCond({
                        tradeId,
                        triggerType: direction as TradeConditionTriggerType,
                        triggerValue: { price: tpPrice },
                        actionType: "partial_close" as TradeConditionActionType,
                        actionParams: { units },
                        label: action.label,
                        analysisId,
                        createdBy: "ai",
                      })
                      appliedIds.push(action.id)
                      console.log(
                        `[ai-executor] Auto-applied action: ${action.label} (adjust_tp_partial → condition: partial close ${units} units at ${tpPrice})`,
                      )
                    }
                    break
                  }
                  // Skip non-executable types: add_condition (uses conditionSuggestions)
                  default:
                    break
                }
              } catch (actionErr) {
                console.warn(
                  `[ai-executor] Failed to auto-apply action "${action.label}":`,
                  (actionErr as Error).message,
                )
              }
            }

            if (appliedIds.length > 0) {
              sections.autoAppliedActionIds = appliedIds
              console.log(
                `[ai-executor] Auto-applied ${appliedIds.length} action(s) for trade ${tradeId}`,
              )
            }
          }
        }
      } catch (settingsErr) {
        console.warn(
          "[ai-executor] Failed to check auto-apply action settings:",
          (settingsErr as Error).message,
        )
      }
    }

    // ─── Calculate cost ────────────────────────────────────────────────
    const { calculateCost } = await import("@fxflow/db")
    const costUsd = calculateCost(model, inputTokens, outputTokens)

    // ─── Broadcast completion ──────────────────────────────────────────
    broadcast({
      type: "ai_analysis_completed",
      timestamp: new Date().toISOString(),
      data: {
        analysisId,
        tradeId,
        sections,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
      },
    })

    sendProgress("Analysis complete!", 100)

    // ─── Create notification ───────────────────────────────────────────
    const autoLabel = triggeredBy !== "user" ? " (Auto)" : ""
    const pairLabel = context.trade.instrument.replace("_", "/")
    await createNotification({
      severity: "info",
      source: "ai_analysis",
      title: `AI Analysis Complete${autoLabel}`,
      message: `${pairLabel} ${context.trade.direction} — Win probability: ${sections.winProbability ?? "N/A"}% | Quality: ${sections.tradeQualityScore ?? "N/A"}/10`,
      metadata: { analysisId, tradeId },
    })
  } catch (err) {
    const errorMessage = (err as Error).message
    console.error(`[ai-executor] Analysis ${analysisId} failed:`, errorMessage)

    await updateAnalysisStatus(analysisId, "failed", errorMessage)

    broadcast({
      type: "ai_analysis_completed",
      timestamp: new Date().toISOString(),
      data: {
        analysisId,
        tradeId,
        sections: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      },
    })

    // Notify user of failure so it appears in the notification panel
    try {
      await createNotification({
        severity: "warning",
        source: "ai_analysis",
        title: "AI Analysis Failed",
        message: errorMessage,
        metadata: { analysisId, tradeId },
      })
    } catch {
      /* ignore notification failure */
    }
  } finally {
    activeControllers.delete(analysisId)
  }
}

// ─── Session Guidance ──────────────────────────────────────────────────────────

function getSessionGuidance(hour: number): string {
  if (hour >= 0 && hour < 7) {
    return "Asian Session (00:00-07:00 UTC): Typically lower volatility, range-bound. JPY pairs may see spikes around Tokyo fix (00:55 UTC). Wide stops may not get tested. Best for range strategies."
  } else if (hour >= 7 && hour < 8.5) {
    return "London Open (07:00-08:30 UTC): Highest volatility period. Breakouts common. Watch for stop hunts above/below Asian range. Big moves often start here."
  } else if (hour >= 8 && hour < 13) {
    return "London Session (08:00-13:00 UTC): Peak liquidity for EUR and GBP pairs. Trend days often establish direction by 10:00 UTC."
  } else if (hour >= 13 && hour < 16) {
    return "London/NY Overlap (13:00-16:00 UTC): Peak global liquidity. Best conditions for trend continuation. Major US economic releases at 13:30 UTC."
  } else if (hour >= 16 && hour < 21) {
    return "NY Session (16:00-21:00 UTC): Watch for NY fix (15:00 UTC London). Reversals common after 19:00 UTC as liquidity thins."
  } else {
    return "Late NY/Pre-Asian (21:00-00:00 UTC): Low liquidity. Wide spreads. Avoid new entries unless trading AUD/NZD ahead of Asian session."
  }
}

// ─── User Message Builder ─────────────────────────────────────────────────────

function buildUserMessage(context: TradeContextSnapshot, depth: AiAnalysisDepth): string {
  const {
    trade,
    account,
    livePrice,
    indicators,
    history,
    conditions,
    newsEvents,
    forexNews,
    previousAnalyses,
    marketSession,
    correlatedPairs,
    openPositions,
    gatheringErrors,
  } = context
  const pair = trade.instrument.replace("_", "/")
  const isOpen = trade.status === "open"
  const isPending = trade.status === "pending"
  const isClosed = trade.status === "closed"

  const sections: string[] = []

  sections.push(`## Trade Analysis Request

**Pair:** ${pair} | **Direction:** ${trade.direction.toUpperCase()} | **Status:** ${trade.status.toUpperCase()}
**Timeframe:** ${trade.timeframe ?? "Not specified"}
**Trade ID:** ${trade.id}`)

  sections.push(`## Trade Details

- Entry Price: ${trade.entryPrice}
- Exit Price: ${trade.exitPrice ?? "N/A (not yet closed)"}
- Stop Loss: ${trade.stopLoss ?? "None set"}
- Take Profit: ${trade.takeProfit ?? "None set"}
- Trailing Stop Distance: ${trade.trailingStopDistance ?? "None"}
- Initial Units: ${trade.initialUnits}
- Current Units: ${trade.currentUnits}
- Realized P&L: ${trade.realizedPL}
- Unrealized P&L: ${trade.unrealizedPL}
- Financing: ${trade.financing}
- Close Reason: ${trade.closeReason ?? "N/A"}
- Time In Force: ${trade.timeInForce ?? "N/A"}
- GTD Time: ${trade.gtdTime ?? "N/A"}
- MFE (Max Favorable Excursion): ${trade.mfe ?? "N/A"} pips
- MAE (Max Adverse Excursion): ${trade.mae ?? "N/A"} pips
- Opened At: ${trade.openedAt}
- Closed At: ${trade.closedAt ?? "Still open"}`)

  if (trade.notes) {
    sections.push(`## Trader's Notes\n\n${trade.notes}`)
  }

  if (trade.tags.length > 0) {
    sections.push(`## Tags\n\n${trade.tags.join(", ")}`)
  }

  if (livePrice) {
    sections.push(`## Live Market Price

- Bid: ${livePrice.bid}
- Ask: ${livePrice.ask}
- Mid: ${livePrice.mid}
- Distance to Stop Loss: ${livePrice.distanceToSL ?? "N/A"} pips
- Distance to Take Profit: ${livePrice.distanceToTP ?? "N/A"} pips
- Current P&L: ${livePrice.currentPL}`)
  }

  sections.push(`## Account Context

- Balance: ${account.balance}
- Net Asset Value: ${account.nav}
- Unrealized P&L (all trades): ${account.unrealizedPL}
- Margin Used: ${account.marginUsed}
- Margin Available: ${account.marginAvailable}
- Open Trades: ${account.openTradeCount}
- Pending Orders: ${account.pendingOrderCount}
- Today's P&L: ${account.todayPL}`)

  sections.push(`## Technical Analysis (H1 Indicators)

- RSI(14): ${indicators.rsi14 ?? "N/A"}
- ATR(14): ${indicators.atr14 ?? "N/A"}
- EMA(20): ${indicators.ema20 ?? "N/A"}
- EMA(50): ${indicators.ema50 ?? "N/A"}
- EMA Trend: ${indicators.trend}
- Key Resistance Levels: ${indicators.keyResistanceLevels.join(", ")}
- Key Support Levels: ${indicators.keySupportLevels.join(", ")}`)

  // Include candle summaries (not all candles — too many tokens)
  if (context.candles.H1.length > 0) {
    const recent = context.candles.H1.slice(-10)
    sections.push(`## Recent H1 Candles (last 10)

${recent.map((c) => `${c.time.slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`).join("\n")}`)
  }

  if (context.candles.M15.length > 0) {
    const recent = context.candles.M15.slice(-10)
    sections.push(`## M15 Candle Summary (Last 10)

${recent.map((c) => `${c.time.slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close}`).join("\n")}`)
  }

  if (depth !== "quick" && context.candles.H4.length > 0) {
    const recent = context.candles.H4.slice(-6)
    sections.push(`## Recent H4 Candles (last 6)

${recent.map((c) => `${c.time.slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close}`).join("\n")}`)
  }

  if (correlatedPairs.length > 0) {
    sections.push(`## Correlated Pairs (H1 Trend)

${correlatedPairs.map((p) => `- ${p.instrument.replace("_", "/")}: ${p.h1Trend.toUpperCase()} (last close: ${p.lastClose})`).join("\n")}`)
  }

  if (openPositions.length > 0) {
    sections.push(`## Portfolio Context — Open Positions

${openPositions.map((p) => `- ${p.instrument.replace("_", "/")}: ${p.direction.toUpperCase()} ${p.units} units | P&L: ${p.unrealizedPL}`).join("\n")}`)
  }

  sections.push(`## Trade History for ${pair}

- Total Past Trades: ${history.totalTrades}
- Win Rate: ${history.winRate}%
- Wins: ${history.wins} | Losses: ${history.losses} | Breakeven: ${history.breakeven}
- Average Win: ${history.avgWinPips} pips
- Average Loss: ${history.avgLossPips} pips
- Average Duration: ${history.avgDurationHours}h

### Recent Trades
${history.recentTrades
  .slice(0, 8)
  .map(
    (t) =>
      `- ${t.direction.toUpperCase()} | Entry: ${t.entryPrice} | Exit: ${t.exitPrice ?? "N/A"} | P&L: ${t.realizedPL} | ${t.outcome.toUpperCase()} | Duration: ${t.duration}`,
  )
  .join("\n")}`)

  if (conditions.length > 0) {
    sections.push(`## Active Trade Conditions

${conditions.map((c) => `- [${c.status}] ${c.label ?? "No label"}: When ${c.triggerType} ${JSON.stringify(c.triggerValue)}, then ${c.actionType} ${JSON.stringify(c.actionParams)}`).join("\n")}`)
  }

  if (newsEvents.length > 0) {
    sections.push(`## Upcoming Economic Events (next 3 days)

${newsEvents.map((e) => `- [${e.impact.toUpperCase()}] ${e.currency}: ${e.title} | ${e.time} | Forecast: ${e.forecast ?? "N/A"} | Previous: ${e.previous ?? "N/A"}`).join("\n")}`)
  }

  if (forexNews.length > 0) {
    sections.push(`## Recent Market News

${forexNews
  .slice(0, 5)
  .map((n) => `- ${n.headline} (${n.source}): ${n.summary}`)
  .join("\n")}`)
  }

  if (previousAnalyses.length > 0) {
    sections.push(`## Previous AI Analyses

${previousAnalyses.map((a) => `- [${a.depth} | ${a.model} | ${a.createdAt}] Win prob: ${a.winProbability ?? "N/A"}% | Quality: ${a.tradeQualityScore ?? "N/A"}/10\n  Summary: ${a.summaryText}`).join("\n\n")}`)
  }

  const utcHour = new Date().getUTCHours() + new Date().getUTCMinutes() / 60
  sections.push(
    `## Market Session\n\n${marketSession}\n\n### Session Trading Context\n\n${getSessionGuidance(utcHour)}`,
  )

  if (trade.events.length > 0) {
    sections.push(`## Trade Modification History

${trade.events.map((e) => `- [${e.createdAt}] ${e.eventType}: ${JSON.stringify(e.detail)}`).join("\n")}`)
  }

  if (gatheringErrors.length > 0) {
    sections.push(
      `## Data Gathering Notes\n\nSome data could not be retrieved:\n${gatheringErrors.map((e) => `- ${e}`).join("\n")}`,
    )
  }

  sections.push(`---

Please analyze this ${isClosed ? "closed" : isPending ? "pending" : "open"} ${pair} trade and provide your professional assessment.

${isClosed ? "This trade is CLOSED. Focus on post-mortem analysis: what went right, what went wrong, what could have been done better, and what to watch for next time. Do NOT include immediateActions (set to empty array). Provide a detailed postMortem field." : ""}
${isPending ? "This is a PENDING ORDER waiting to fill. Analyze the entry quality, market conditions, and whether this is a good setup to keep or cancel." : ""}
${isOpen ? "This is an OPEN TRADE. Focus on current trade management: whether to hold, adjust stops, take partial profits, or close." : ""}

Respond with ONLY the JSON object described in the system prompt. No other text.`)

  return sections.join("\n\n")
}
