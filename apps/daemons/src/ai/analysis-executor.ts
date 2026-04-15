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
import { classifyAiError, conditionsMatch } from "@fxflow/shared"
import type { AiReconciliationLogEntry } from "@fxflow/types"
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
  "conditionChanges": [
    // OMIT this field entirely on first-run analyses. On re-runs when the
    // trade already has active conditions, emit one entry per existing
    // condition (keep | update | remove) and any genuinely new ideas as
    // "add". See "Re-analysis Reconciliation Instructions" below for rules.
    {
      "op": "keep",
      "existingConditionId": "string (the ID from the Active Trade Conditions list)",
      "reason": "string (why the rule is still valid)"
    }
    // OR:
    // { "op": "update", "existingConditionId": "...", "newTriggerValue": {...}, "newActionParams": {...}, "newLabel": "...", "reason": "..." }
    // { "op": "remove", "existingConditionId": "...", "reason": "thesis invalidated because..." }
    // { "op": "add", "condition": { ...AiConditionSuggestion... }, "reason": "new idea because..." }
  ],
  "immediateActionChanges": [
    // OMIT on first-run analyses. On re-runs, reconcile against the
    // "Previously suggested immediate actions" list. Same op model:
    // keep | update | remove | add.
    {
      "op": "keep",
      "existingActionId": "string (ID from the Previously suggested immediate actions list)",
      "reason": "string"
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
- For trailing stop suggestions, use triggerType "trailing_stop" with triggerValue { distance_pips: number, step_pips?: number }. The distance_pips is the trailing distance from the current price, and step_pips (optional) is the minimum step size for the trailing stop to move.

BREAKEVEN & STOP-LOSS MANAGEMENT RULES (CRITICAL — these prevent premature stop-outs):
- NEVER suggest moving SL to breakeven unless the trade has captured at least 40% of the distance to its take-profit target. If no TP is set, require at least 1.5× the original risk (distance from entry to SL) in unrealized profit before suggesting breakeven.
- NEVER suggest breakeven if the ATR(H1) value exceeds 50% of the original stop-loss distance — the normal market noise alone would trigger the breakeven SL, causing a needless exit.
- NEVER suggest breakeven on trades that have been open for less than 15 minutes — the trade needs time to develop beyond initial volatility.
- If a major economic news event (high impact) is within 2 hours, cap breakeven condition confidence at "low" — news-driven volatility makes tight SL placement dangerous.
- When suggesting a breakeven move_stop_loss condition, set the actionParams.price to the EXACT entry price — the system will automatically add a spread + volatility buffer at execution time. Do NOT manually add a buffer in the price.
- Consider MFE (Max Favorable Excursion): if the trade's MFE is significantly higher than the current price (i.e., price has already retraced), breakeven may be appropriate to protect remaining gains. If MFE is close to current price (trade still near peak), prefer a trailing stop instead.
- Consider the trade's timeframe: scalp trades (M15 timeframe) warrant tighter breakeven triggers (e.g., +8-10 pips) while swing trades (H4/D1) need wider triggers (e.g., +30-50 pips) to avoid being shaken out by normal retracements.
- For conditionSuggestions with actionType "move_stop_loss" where the target is near entry price, set the pnl_pips trigger to at least 1.5× ATR(H1) in pips to avoid whipsaw triggers from normal price oscillation.
- PREFER trailing stops over breakeven when the trade is trending strongly (confluence score >= 7 and alignment is "strong"). Breakeven locks in zero profit; a trailing stop captures the trend.`

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
const activeStreams = new Map<string, { abort: () => void }>()

function abortAnalysis(analysisId: string): void {
  const controller = activeControllers.get(analysisId)
  if (controller) {
    controller.abort()
    activeControllers.delete(analysisId)
  }
  const stream = activeStreams.get(analysisId)
  if (stream) {
    try {
      stream.abort()
    } catch {
      // stream may already be closed — safe to ignore
    }
    activeStreams.delete(analysisId)
  }
}

export function cancelActiveAnalysis(analysisId: string): void {
  abortAnalysis(analysisId)
}

/** Cancel every in-flight analysis and return the count aborted. */
export function cancelAllActiveAnalyses(): number {
  const count = activeControllers.size
  for (const id of [...activeControllers.keys()]) {
    abortAnalysis(id)
  }
  return count
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

/**
 * Strict JSON extraction from a Claude response.
 *
 * Strategy:
 *   1. Strip optional code fences.
 *   2. `JSON.parse` the remaining text.
 *   3. If that fails, take the substring between the first `{` and last `}`
 *      and try once more.
 *
 * Critically we do NOT attempt to repair truncated JSON by closing dangling
 * braces. The prior "repair" path silently promoted truncated responses to
 * `status: "completed"` with missing recommendations — the user never saw
 * the truncation warning and thought the analysis was complete. Truncation
 * is now detected via the Anthropic `stop_reason` field on `message_delta`
 * and surfaced as `status: "partial"` + a UI banner.
 *
 * Returns `null` when parsing fails entirely — the caller decides whether to
 * mark the analysis as `"failed"` (unparseable) or `"partial"` (truncated but
 * the stream itself was healthy).
 */
function tryExtractJson<T>(raw: string): T | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fenceStripped = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "")
    : trimmed

  try {
    return JSON.parse(fenceStripped) as T
  } catch {
    // Fall through to substring extraction.
  }

  const firstBrace = fenceStripped.indexOf("{")
  const lastBrace = fenceStripped.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(fenceStripped.slice(firstBrace, lastBrace + 1)) as T
    } catch {
      // Fall through.
    }
  }

  return null
}

/**
 * Inspect a parsed analysis object for semantic completeness. Returns the
 * names of fields that are missing or empty so the UI can render
 * "not generated — response truncated" placeholders and the caller can
 * decide whether to flag the analysis as partial even when JSON parsed.
 *
 * A completely successful analysis returns an empty array.
 */
function findMissingSections(sections: AiAnalysisSections | null): string[] {
  if (!sections) return ["all"]
  const missing: string[] = []
  if (!sections.summary?.trim()) missing.push("summary")
  if (sections.winProbability == null) missing.push("winProbability")
  if (sections.tradeQualityScore == null) missing.push("tradeQualityScore")
  if (!sections.technical?.trend) missing.push("technical")
  if (!sections.risk?.factors || sections.risk.factors.length === 0) missing.push("risk.factors")
  // Recommendations / actions are optional for closed trades (post-mortem)
  // so we don't require them here — the UI decides based on tradeStatus.
  return missing
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
    // ─── Budget cap enforcement ────────────────────────────────────────
    //
    // Before spending any tokens, check the month-to-date AI cost against
    // the user's configured monthly cap. Hard stop (not just a warn) when
    // exceeded — the user can always raise the cap in Settings or delete
    // this guard for a single run via the override toggle (future work).
    //
    // Scheduled/auto-triggered analyses enforce the cap strictly. Manual
    // user-triggered runs still block but the UI surfaces a specific
    // "monthly budget cap reached" error so the user can take action.
    try {
      const { getAiSettings, getUsageStats } = await import("@fxflow/db")
      const settings = await getAiSettings()
      const cap = settings.monthlyBudgetCapUsd
      if (cap != null && cap > 0) {
        const stats = await getUsageStats()
        const monthSpend = stats.byPeriod.thisMonth.costUsd ?? 0
        if (monthSpend >= cap) {
          const msg = `Monthly AI budget cap reached ($${monthSpend.toFixed(2)} / $${cap.toFixed(2)}). Raise the cap in Settings → AI or wait until next month.`
          console.warn(`[ai-executor] ${msg}`)
          await updateAnalysisStatus(analysisId, "failed", msg)
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
              durationMs: 0,
              error: msg,
            },
          })
          activeControllers.delete(analysisId)
          return
        }
      }
    } catch (capErr) {
      // Fail open: if the budget check itself errors, don't block the
      // analysis. Better to spend than to silently block on a DB hiccup.
      console.warn("[ai-executor] Budget cap check failed:", (capErr as Error).message)
    }

    await updateAnalysisStatus(analysisId, "running")

    broadcast({
      type: "ai_analysis_started",
      timestamp: new Date().toISOString(),
      data: { analysisId, tradeId, model, depth },
    })

    // ─── Preflight: refresh trade state from OANDA ─────────────────────
    //
    // Before spending tokens, force a reconcile so we're guaranteed to see
    // the OANDA truth for this trade. This closes the race where a trade
    // was closed externally (SL/TP/manual-close-on-phone) between the last
    // background reconcile and the moment the user clicked Analyze. Without
    // this step, the executor could feed Claude stale `status: "open"` data
    // and produce nonsensical "hold" recommendations on a trade that no
    // longer exists — exactly the failure mode the April 13 ghost-trade
    // analysis demonstrated.
    //
    // After the refresh we re-read the trade from the DB and abort with a
    // specific error if it's no longer open/pending. Failing open (on
    // refresh errors) is fine — context gathering will catch stale state
    // via its own DB read, and we still save tokens for the common path.
    try {
      await tradeSyncer.refreshPositions()
      const { db: preflightDb } = await import("@fxflow/db")
      const freshTrade = await preflightDb.trade.findUnique({
        where: { id: tradeId },
        select: { status: true, instrument: true },
      })
      if (freshTrade && freshTrade.status === "closed" && tradeStatus !== "closed") {
        // Trade was closed since the analysis was requested — abort cleanly.
        const pair = freshTrade.instrument.replace("_", "/")
        const msg = `Trade was closed on OANDA before analysis could run (${pair}). Run a post-mortem analysis instead.`
        await updateAnalysisStatus(analysisId, "failed", msg)
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
            error: msg,
          },
        })
        activeControllers.delete(analysisId)
        return
      }
    } catch (preflightErr) {
      console.warn(
        `[ai-executor] Preflight refresh failed (continuing):`,
        (preflightErr as Error).message,
      )
    }

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

    // ─── Max tokens ────────────────────────────────────────────────────
    //
    // Always request the model's maximum output. Earlier tiered limits
    // (3k/6k/10k) caused silent truncation — the executor then ran a repair
    // loop that closed dangling braces, producing "valid" JSON missing half
    // the recommendations. The user was shown a "completed" analysis with no
    // indication that recommendations were dropped. Requesting the ceiling
    // makes truncation extremely rare; when it DOES happen (prose-heavy
    // learning mode on a huge trade), the executor now surfaces it via
    // `status: "partial"` + banner, not by faking success.
    //
    // Haiku caps at 8192 output tokens, Sonnet 4.6 at 64_000, Opus 4.6 at
    // 32_000. These are the hard ceilings of the current model line.
    const maxTokensForModel = (m: AiClaudeModel): number => {
      if (m.includes("haiku")) return 8192
      if (m.includes("opus")) return 32_000
      return 64_000 // sonnet
    }

    // ─── Stream from Claude (with 3-minute timeout) ────────────────────
    const STREAM_TIMEOUT_MS = 180_000 // 3 minutes
    let rawResponse = ""
    let inputTokens = 0
    let outputTokens = 0
    let cacheReadTokens = 0
    let cacheWriteTokens = 0
    /**
     * Anthropic `stop_reason` captured from the `message_delta` event that
     * closes the stream. Drives the truncation-detection path below — when
     * this is `"max_tokens"` the analysis is saved as `status: "partial"`
     * regardless of whether the JSON happens to parse.
     */
    let stopReason: string | null = null

    // Enable Anthropic prompt caching on the system prompt. The system
    // prompt is ~7KB of trading-rules boilerplate that is *identical*
    // across analyses — marking it as a cacheable content block gives
    // us ~90% discount on cached input tokens and a latency reduction
    // on re-runs within the 5-minute cache window. Even first-run calls
    // benefit from cache hits if the user analyzes multiple trades in
    // quick succession.
    const baseOpts = {
      model,
      max_tokens: maxTokensForModel(model),
      system: [
        {
          type: "text" as const,
          text: systemPrompt,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user" as const, content: userMessage }],
    }

    // Enable extended thinking for deep analysis (non-haiku models)
    const streamOpts =
      depth === "deep" && !model.includes("haiku")
        ? { ...baseOpts, thinking: { type: "enabled" as const, budget_tokens: 8000 } }
        : baseOpts

    const stream = anthropic.messages.stream(streamOpts)
    activeStreams.set(analysisId, stream)

    // Set a timeout that aborts BOTH the controller AND the stream directly.
    // The controller.abort() alone isn't sufficient because the `for await` loop
    // blocks waiting for the next event — if the API hangs and never yields,
    // the abort signal check inside the loop body never executes.
    const streamTimeout = setTimeout(() => {
      if (!controller.signal.aborted) {
        console.warn(
          `[ai-executor] Analysis ${analysisId} timed out after ${STREAM_TIMEOUT_MS / 1000}s`,
        )
        controller.abort()
        try {
          stream.abort() // Break the stream iterator directly
        } catch {
          // stream.abort() may throw if already closed — safe to ignore
        }
      }
    }, STREAM_TIMEOUT_MS)

    try {
      for await (const event of stream) {
        if (controller.signal.aborted) {
          stream.abort()
          // Distinguish timeout from user cancellation
          const isTimeout = rawResponse.length > 0
          const abortError = isTimeout
            ? `Analysis timed out after ${STREAM_TIMEOUT_MS / 1000} seconds`
            : "Analysis cancelled by user"
          if (isTimeout) {
            await updateAnalysisStatus(analysisId, "failed", abortError)
          } else {
            // User-cancelled — preserve whatever stream text we have so the
            // UI can render "here's what Claude got to before you stopped it".
            // Cap at 100KB to match the client-side limit.
            const { cancelAnalysis } = await import("@fxflow/db")
            await cancelAnalysis(
              analysisId,
              rawResponse.length > 0 ? rawResponse.slice(0, 100_000) : null,
            )
          }

          // Broadcast completion so the UI clears its spinner
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
              durationMs: Date.now() - startTime,
              error: abortError,
            },
          })

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
        } else if (event.type === "message_delta") {
          if (event.usage) outputTokens = event.usage.output_tokens
          // `message_delta` is the last event before `message_stop` and
          // carries the final `stop_reason`. We check for `"max_tokens"`
          // below to decide whether to persist the analysis as partial.
          const delta = event.delta as { stop_reason?: string | null }
          if (delta?.stop_reason) stopReason = delta.stop_reason
        } else if (event.type === "message_start" && event.message.usage) {
          inputTokens = event.message.usage.input_tokens
          // Track prompt-cache usage when available. These fields are only
          // present when the model actually read from or wrote to the
          // ephemeral cache, so they may be zero on first-run analyses.
          const usage = event.message.usage as {
            input_tokens: number
            cache_read_input_tokens?: number
            cache_creation_input_tokens?: number
          }
          cacheReadTokens = usage.cache_read_input_tokens ?? 0
          cacheWriteTokens = usage.cache_creation_input_tokens ?? 0
        }
      }
    } finally {
      clearTimeout(streamTimeout)
    }

    // ─── Parse JSON response ───────────────────────────────────────────
    //
    // Three outcomes:
    //  1. Parse succeeds, `stop_reason !== "max_tokens"`, all required
    //     sections present → status "completed".
    //  2. Parse succeeds BUT `stop_reason === "max_tokens"` OR required
    //     sections are missing → status "partial" with the parsed payload
    //     persisted so the UI can render whatever came through and surface
    //     the truncation banner.
    //  3. Parse fails entirely → status "failed" with rawResponse for
    //     debugging. This now only fires on truly malformed JSON — the old
    //     "repair braces" fallback that masked truncation is gone.
    const sections = tryExtractJson<AiAnalysisSections>(rawResponse)
    const missingSections = findMissingSections(sections)
    const truncatedByStopReason = stopReason === "max_tokens"
    const truncated = truncatedByStopReason || (sections !== null && missingSections.length > 0)

    const durationMs = Date.now() - startTime

    // ─── Handle hard parse failure ─────────────────────────────────────
    if (!sections) {
      let parseError: string
      if (rawResponse.trim().length === 0) {
        parseError = "AI returned an empty response"
      } else if (truncatedByStopReason) {
        parseError =
          "AI response was truncated by the model token limit before any valid JSON could be parsed. Try a shorter depth or retry."
      } else {
        parseError = "AI response contained invalid JSON structure"
      }

      await updateAnalysisStatus(analysisId, "failed", parseError, rawResponse || undefined)

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
          truncated: truncatedByStopReason,
          stopReason,
          error: parseError,
        },
      })

      sendProgress("Analysis failed", 100)

      const pairLabel = context.trade.instrument.replace("_", "/")
      await createNotification({
        severity: "warning",
        source: "ai_analysis",
        title: truncatedByStopReason ? "AI Analysis — Truncated" : "AI Analysis — Parse Error",
        message: `${pairLabel} ${context.trade.direction} — ${parseError}`,
        metadata: { analysisId, tradeId },
      })
      return
    }

    if (truncated) {
      console.warn(
        `[ai-executor] Analysis ${analysisId} truncated: stopReason=${stopReason ?? "n/a"}, missing=[${missingSections.join(",")}]`,
      )
    }

    // ─── Save result ───────────────────────────────────────────────────
    // Reconciliation log is built below when applying conditionChanges; we
    // persist the final log after the auto-apply block so a single save
    // covers both the AI output and the side-effects we executed.
    const schemaVersion = sections.conditionChanges || sections.immediateActionChanges ? 2 : 1
    const reconciliationLog: AiReconciliationLogEntry[] = []

    await saveAnalysisResult(analysisId, {
      rawResponse,
      sections,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      durationMs,
      schemaVersion,
      truncated,
      stopReason,
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

    // ─── Apply structured reconciliation diff (v2 re-runs) ───────────
    //
    // On re-runs, the AI emits explicit ops against existing conditions:
    // keep / update / remove / add. This block executes them in order,
    // respecting a hard cap from settings so a malformed response can't
    // nuke every rule on the trade. Each op is journaled in
    // `reconciliationLog` for the diff view. Fall through to the legacy
    // `conditionSuggestions` auto-apply below when this field is absent.
    if (sections.conditionChanges?.length && tradeStatus !== "closed") {
      try {
        const { getAiSettings, updateCondition, deleteCondition, listConditionsForTrade } =
          await import("@fxflow/db")
        const aiSettings = await getAiSettings()
        const maxOps = aiSettings.maxReconciliationOps ?? 20
        const existing = await listConditionsForTrade(tradeId)
        const existingById = new Map(existing.map((c) => [c.id, c]))

        let opsExecuted = 0
        for (const change of sections.conditionChanges) {
          if (opsExecuted >= maxOps) {
            console.warn(
              `[ai-executor] Reconciliation cap (${maxOps}) hit — skipping remaining ops`,
            )
            break
          }

          const nowIso = new Date().toISOString()
          try {
            if (change.op === "keep") {
              const target = existingById.get(change.existingConditionId)
              reconciliationLog.push({
                target: "condition",
                op: "keep",
                existingId: change.existingConditionId,
                label: target?.label ?? "(unknown)",
                reason: change.reason,
                at: nowIso,
              })
              continue // keep is a no-op — don't count toward cap
            }

            if (change.op === "update") {
              const target = existingById.get(change.existingConditionId)
              if (!target) {
                console.warn(
                  `[ai-executor] update op references unknown condition ${change.existingConditionId}`,
                )
                continue
              }
              const updated = await updateCondition(change.existingConditionId, {
                triggerValue: change.newTriggerValue,
                actionParams: change.newActionParams,
                label: change.newLabel ?? target.label,
              })
              if (updated && conditionMonitor) {
                await conditionMonitor.reloadCondition(updated.id)
              }
              reconciliationLog.push({
                target: "condition",
                op: "update",
                existingId: change.existingConditionId,
                resultId: updated?.id,
                label: change.newLabel ?? target.label ?? "(unknown)",
                reason: change.reason,
                at: nowIso,
              })
              opsExecuted++
              continue
            }

            if (change.op === "remove") {
              const target = existingById.get(change.existingConditionId)
              await deleteCondition(change.existingConditionId)
              reconciliationLog.push({
                target: "condition",
                op: "remove",
                existingId: change.existingConditionId,
                label: target?.label ?? "(unknown)",
                reason: change.reason,
                at: nowIso,
              })
              opsExecuted++
              continue
            }

            if (change.op === "add") {
              // Reuse the confidence + dedup path below by pushing into
              // sections.conditionSuggestions if not already there. We
              // rely on conditionsMatch-based dedup in the existing block
              // so we don't double-create.
              if (!sections.conditionSuggestions) sections.conditionSuggestions = []
              sections.conditionSuggestions.push(change.condition)
              reconciliationLog.push({
                target: "condition",
                op: "add",
                label: change.condition.label,
                reason: change.reason,
                at: nowIso,
              })
              // Don't count here — actual creation is counted below.
              continue
            }
          } catch (opErr) {
            console.warn(
              `[ai-executor] Reconciliation op failed (${change.op}):`,
              (opErr as Error).message,
            )
          }
        }
      } catch (reconErr) {
        console.warn("[ai-executor] Reconciliation executor failed:", (reconErr as Error).message)
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
          // SL-modifying conditions (breakeven, move SL) use a separate, stricter threshold
          const minSLCondConf = aiSettings.autoAnalysis.autoApplyMinSLConditionConfidence ?? "high"
          const condConfRank: Record<string, number> = { high: 3, medium: 2, low: 1 }
          const minCondRank = condConfRank[minCondConf] ?? 2
          const minSLCondRank = condConfRank[minSLCondConf] ?? 3

          // Fetch existing conditions to prevent duplicates
          const existing = await listConditionsForTrade(tradeId)
          const activeConditions = existing.filter((c) => c.status === "active")

          console.log(
            `[ai-executor] Auto-applying conditions for trade ${tradeId} (${sections.conditionSuggestions.length} suggested, ${activeConditions.length} already active, minConfidence: ${minCondConf}, minSLConfidence: ${minSLCondConf})`,
          )
          for (const suggestion of sections.conditionSuggestions) {
            // Filter by confidence threshold — SL-modifying conditions use stricter bar
            const isSLCondition = suggestion.actionType === "move_stop_loss"
            const effectiveMinRank = isSLCondition ? minSLCondRank : minCondRank
            const effectiveMinConf = isSLCondition ? minSLCondConf : minCondConf
            const suggestionConf = suggestion.confidence ?? "medium" // default to medium if AI omits
            const suggestionRank = condConfRank[suggestionConf] ?? 2
            if (suggestionRank < effectiveMinRank) {
              console.log(
                `[ai-executor] Skipping ${isSLCondition ? "SL " : ""}low-confidence condition: ${suggestion.label} (${suggestionConf} < ${effectiveMinConf})`,
              )
              continue
            }

            // Dedup: skip if an active condition represents the same rule within tolerance.
            // Uses the shared `conditionsMatch` helper so the daemon and web UI stay in
            // lockstep — label text is ignored and numeric params use pip-aware tolerance.
            const isDuplicate = activeConditions.some((c) =>
              conditionsMatch(
                {
                  triggerType: suggestion.triggerType,
                  triggerValue: suggestion.triggerValue,
                  actionType: suggestion.actionType,
                  actionParams: suggestion.actionParams,
                },
                {
                  triggerType: c.triggerType,
                  triggerValue: c.triggerValue,
                  actionType: c.actionType,
                  actionParams: c.actionParams,
                },
                { instrument: context.trade.instrument },
              ),
            )
            if (isDuplicate) {
              console.log(`[ai-executor] Skipping duplicate condition: ${suggestion.label}`)
              continue
            }
            try {
              // AI-created conditions use tiered expiry by action type:
              // SL moves expire fastest (market structure changes quickly),
              // trailing stops a bit longer, everything else gets 7 days.
              const EXPIRY_MS_BY_ACTION: Record<string, number> = {
                move_stop_loss: 2 * 86_400_000, // 48 hours
                move_take_profit: 5 * 86_400_000, // 5 days
                close_trade: 7 * 86_400_000, // 7 days
                partial_close: 7 * 86_400_000, // 7 days
                cancel_order: 7 * 86_400_000, // 7 days
                notify: 7 * 86_400_000, // 7 days
              }
              // Trailing stop trigger type gets 72h regardless of action
              const expiryMs =
                suggestion.triggerType === "trailing_stop"
                  ? 3 * 86_400_000
                  : (EXPIRY_MS_BY_ACTION[suggestion.actionType] ?? 7 * 86_400_000)
              const expiresAt = new Date(Date.now() + expiryMs)

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
            const autoApplyErrors: Array<{ actionId: string; label: string; error: string }> = []
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
                      {
                        closedBy: "ai_condition",
                        closedByLabel: "AI Analysis",
                        closedByDetail: action.label,
                      },
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
                        {
                          closedBy: "ai_condition",
                          closedByLabel: "AI Analysis",
                          closedByDetail: `${action.label} (${units} units)`,
                        },
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
                const errMsg = (actionErr as Error).message
                console.warn(`[ai-executor] Failed to auto-apply action "${action.label}":`, errMsg)
                autoApplyErrors.push({ actionId: action.id, label: action.label, error: errMsg })
              }
            }

            if (appliedIds.length > 0) {
              sections.autoAppliedActionIds = appliedIds
              console.log(
                `[ai-executor] Auto-applied ${appliedIds.length} action(s) for trade ${tradeId}`,
              )
            }
            if (autoApplyErrors.length > 0) {
              sections.autoApplyErrors = autoApplyErrors
              console.warn(
                `[ai-executor] ${autoApplyErrors.length} auto-apply error(s) for trade ${tradeId}`,
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

    // ─── Persist reconciliation log ────────────────────────────────────
    // Write back the accumulated ops from Part B2 now that all auto-apply
    // side-effects are done. Done as a second save so the side-effects
    // have already committed by the time the log references them.
    if (reconciliationLog.length > 0) {
      try {
        const { db: prismaDb } = await import("@fxflow/db")
        await prismaDb.aiAnalysis.update({
          where: { id: analysisId },
          data: { reconciliationLog: JSON.stringify(reconciliationLog) },
        })
      } catch (logErr) {
        console.warn(
          "[ai-executor] Failed to persist reconciliation log:",
          (logErr as Error).message,
        )
      }
    }

    // ─── Calculate cost ────────────────────────────────────────────────
    const { calculateCost } = await import("@fxflow/db")
    const costUsd = calculateCost(model, inputTokens, outputTokens)

    // ─── Broadcast completion ──────────────────────────────────────────
    const STREAM_TRUNCATION_THRESHOLD = 100_000 // 100KB, matches client-side limit
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
        streamTruncated: rawResponse.length >= STREAM_TRUNCATION_THRESHOLD,
        truncated,
        stopReason,
        autoApplyErrors: sections.autoApplyErrors,
      },
    })

    sendProgress(truncated ? "Analysis complete (truncated)" : "Analysis complete!", 100)

    // ─── Create notification ───────────────────────────────────────────
    const autoLabel = triggeredBy !== "user" ? " (Auto)" : ""
    const pairLabel = context.trade.instrument.replace("_", "/")
    await createNotification({
      severity: truncated ? "warning" : "info",
      source: "ai_analysis",
      title: truncated ? `AI Analysis — Partial${autoLabel}` : `AI Analysis Complete${autoLabel}`,
      message: truncated
        ? `${pairLabel} ${context.trade.direction} — response truncated by model token limit; some sections may be missing.`
        : `${pairLabel} ${context.trade.direction} — Win probability: ${sections.winProbability ?? "N/A"}% | Quality: ${sections.tradeQualityScore ?? "N/A"}/10`,
      metadata: { analysisId, tradeId },
    })
  } catch (err) {
    const errorMessage = (err as Error).message
    console.error(`[ai-executor] Analysis ${analysisId} failed:`, errorMessage)

    // Classify and broadcast actionable AI API errors
    const classified = classifyAiError(err)
    if (classified.category !== "unknown") {
      broadcast({
        type: "ai_error_alert",
        timestamp: new Date().toISOString(),
        data: {
          category: classified.category,
          message: classified.message,
          detail: classified.detail,
          source: "ai_analysis",
          retryable: classified.retryable,
        },
      })
    }

    // Wrap in try-catch so the broadcast ALWAYS fires, even if DB update fails
    try {
      await updateAnalysisStatus(analysisId, "failed", errorMessage)
    } catch (dbErr) {
      console.error("[ai-executor] Failed to update analysis status:", (dbErr as Error).message)
    }

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
    activeStreams.delete(analysisId)
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

  // Pair history — only surface stats when we have a large-enough sample.
  // Below the floor (currently 10 trades) we flag it so Claude doesn't draw
  // conclusions from statistical noise like "0 wins from 3 trades". The
  // recent-trades list is still shown so the model can eyeball individual
  // outcomes, but the aggregate win-rate line is suppressed.
  if (history.insufficientSample) {
    sections.push(`## Trade History for ${pair}

- Total Past Trades: ${history.totalTrades} (INSUFFICIENT SAMPLE — below 10-trade floor)
- IMPORTANT: do NOT draw pair-specific win-rate, average-R, or "common pattern"
  conclusions from this sample. Small samples are noise, not signal. Ignore
  \`pairWinRate\`, \`averageRR\`, and \`commonPatterns\` — explicitly note in
  \`tradeHistory.commonPatterns\` that the sample is too small for this pair.
- Average Duration: ${history.avgDurationHours}h

### Recent Trades (for individual context only — not for aggregate stats)
${history.recentTrades
  .slice(0, 8)
  .map(
    (t) =>
      `- ${t.direction.toUpperCase()} | Entry: ${t.entryPrice} | Exit: ${t.exitPrice ?? "N/A"} | P&L: ${t.realizedPL} | ${t.outcome.toUpperCase()} | Duration: ${t.duration}`,
  )
  .join("\n")}`)
  } else {
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
  }

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
    // Render prior analyses with their FULL conditionSuggestions and
    // immediateActions so the model can see exactly what it previously
    // proposed. This is the missing piece that caused re-runs to blindly
    // re-suggest conditions the user had already reviewed or applied.
    sections.push(`## Previous AI Analyses (most recent first)

${previousAnalyses
  .map((a, idx) => {
    const header = `### Analysis #${idx + 1} — ${a.depth} | ${a.model} | ${a.createdAt}`
    const stats = `Win probability: ${a.winProbability ?? "N/A"}% | Quality score: ${a.tradeQualityScore ?? "N/A"}/10`
    const summary = `Summary: ${a.summaryText}`
    const priorConds =
      a.conditionSuggestions.length > 0
        ? `Previously suggested conditions:\n${a.conditionSuggestions
            .map(
              (c) =>
                `  - ${c.label} [${c.confidence ?? "medium"}]: ${c.triggerType} ${JSON.stringify(c.triggerValue)} → ${c.actionType} ${JSON.stringify(c.actionParams)}`,
            )
            .join("\n")}`
        : "Previously suggested conditions: (none)"
    const priorActions =
      a.immediateActions.length > 0
        ? `Previously suggested immediate actions:\n${a.immediateActions
            .map((ac) => `  - ${ac.label}: ${ac.type} ${JSON.stringify(ac.params ?? {})}`)
            .join("\n")}`
        : "Previously suggested immediate actions: (none)"
    return [header, stats, summary, priorConds, priorActions].join("\n")
  })
  .join("\n\n")}

### Re-analysis Reconciliation Instructions

This trade has previous analyses. Your job is to **reconcile**, not blindly re-propose:

1. **Review the "Active Trade Conditions" section above** — these are rules currently attached to the trade (some may have been auto-applied from a previous analysis, some manually added by the user).
2. **Do NOT re-suggest a condition that already exists as an active condition** with the same trigger/action parameters, even if you would phrase the label differently. The downstream system deduplicates by parameters (not label), so a re-suggestion that matches an existing rule is wasted output.
3. **Do NOT re-suggest an action that the previous analysis already suggested** if the market conditions haven't materially changed — instead, note briefly that the prior recommendation still stands.
4. **DO propose updates or removals** if the market thesis has changed: if a prior stop-loss move no longer makes sense at the current price, call it out explicitly in your summary and omit it from \`conditionSuggestions\`.
5. **DO propose genuinely new rules** when the market has moved and warrants them — e.g., a tighter trailing stop after a significant favorable move, or a take-profit move after a new resistance has formed.
6. When in doubt, prefer **fewer, higher-conviction suggestions** over re-listing everything from before.`)
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
