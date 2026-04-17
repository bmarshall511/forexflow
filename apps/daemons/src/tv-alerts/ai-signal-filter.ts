/**
 * AI Signal Filter — uses Claude Haiku to evaluate whether a TV Alert signal
 * should be executed, given rich market context.
 *
 * This is the single most impactful improvement for UT Bot Alerts because
 * the indicator generates whipsaw losses in ranging markets. The AI filter
 * rejects signals in unfavorable conditions while allowing good setups through.
 *
 * Cost: ~$0.02-0.05 per signal (Haiku). At 20 signals/day = ~$0.40-1.00/day.
 * Latency: ~1-2 seconds (well within H1 candle close window).
 *
 * @module tv-alerts/ai-signal-filter
 */
import Anthropic from "@anthropic-ai/sdk"
import type { ConfluenceBreakdown } from "@fxflow/types"
import { getDecryptedClaudeKey } from "@fxflow/db"

export interface AiFilterResult {
  execute: boolean
  confidence: number
  reason: string
  model: string
  inputTokens: number
  outputTokens: number
  durationMs: number
}

export interface AiFilterContext {
  instrument: string
  direction: "buy" | "sell"
  signalPrice: number | null
  /** Confluence score (0-10) and per-factor breakdown */
  confluenceScore: number | null
  confluenceBreakdown: ConfluenceBreakdown | null
  /** ATR(14) at signal timeframe */
  atr: number
  /** Current spread in pips */
  spreadPips: number | null
  /** Recent signal history for this pair (for whipsaw context) */
  recentSignalCount: number
  /** Current open TV alert trade count */
  openAutoTradeCount: number
  /** Today's P&L from TV alert trades */
  todayPL: number
  /** Recent pair performance */
  recentWins: number
  recentLosses: number
}

const SYSTEM_PROMPT = `You are a forex signal quality filter for UT Bot Alert signals on a 1-hour timeframe.

UT Bot Alerts is a trend-following indicator that uses an ATR-adaptive trailing stop. It fires BUY when price crosses above the trailing stop and SELL when price crosses below. Its biggest weakness is generating rapid buy/sell/buy/sell whipsaw sequences in ranging/choppy markets, producing consistent losses from spread costs and false breakouts.

Your job: Given a signal and its market context, decide if conditions are favorable enough to execute.

REJECT when any of these are true:
- Volatility regime is "ranging" (ADX < 20) — UT Bot whipsaws here
- Volatility regime is "weak_trend" and confluence score < 5 — insufficient conviction
- HTF trend strongly opposes the signal direction
- Momentum (RSI) is extreme against the signal (buy when RSI > 75, sell when RSI < 25)
- Multiple recent signals on same pair suggest choppy conditions (3+ in last 4 hours)
- Spread is > 25% of ATR (high cost relative to expected move)
- Recent pair performance is poor (3+ consecutive losses)

APPROVE when conditions are favorable — trending regime, aligned HTF, good session timing.

Respond with JSON only: {"execute": true/false, "confidence": 0-100, "reason": "one sentence"}`

/**
 * Evaluate a TV alert signal using Claude Haiku.
 * Returns null if the filter can't run (no API key, budget exceeded, etc.)
 */
export async function evaluateSignalWithAI(ctx: AiFilterContext): Promise<AiFilterResult | null> {
  const apiKey = await getDecryptedClaudeKey()
  if (!apiKey) return null // no API key configured — skip filter

  const model = "claude-haiku-4-5-20251001"
  const t0 = Date.now()

  const userMessage = buildUserMessage(ctx)

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model,
      max_tokens: 200,
      system: [
        {
          type: "text" as const,
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    const parsed = parseResponse(text)

    return {
      execute: parsed.execute,
      confidence: parsed.confidence,
      reason: parsed.reason,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs: Date.now() - t0,
    }
  } catch (err) {
    console.error("[ai-signal-filter] Haiku call failed:", (err as Error).message)
    return null // fail-open: if AI filter fails, don't block the signal
  }
}

function buildUserMessage(ctx: AiFilterContext): string {
  const parts: string[] = [
    `Signal: ${ctx.instrument.replace("_", "/")} ${ctx.direction.toUpperCase()}`,
    `Signal price: ${ctx.signalPrice ?? "unknown"}`,
    `ATR(14): ${ctx.atr.toFixed(5)}`,
  ]

  if (ctx.spreadPips !== null) {
    parts.push(`Current spread: ${ctx.spreadPips.toFixed(1)} pips`)
    if (ctx.atr > 0) {
      const spreadPercent =
        ((ctx.spreadPips * (ctx.instrument.includes("JPY") ? 0.01 : 0.0001)) / ctx.atr) * 100
      parts.push(`Spread as % of ATR: ${spreadPercent.toFixed(1)}%`)
    }
  }

  if (ctx.confluenceScore !== null) {
    parts.push(`Confluence score: ${ctx.confluenceScore.toFixed(1)}/10`)
  }

  if (ctx.confluenceBreakdown) {
    const b = ctx.confluenceBreakdown
    parts.push(`Trend (EMA50/200): score ${b.trend.score}/10 — ${formatDetail(b.trend.detail)}`)
    parts.push(`Momentum (RSI): score ${b.momentum.score}/10 — ${formatDetail(b.momentum.detail)}`)
    parts.push(
      `Volatility (ADX): score ${b.volatility.score}/10 — ${formatDetail(b.volatility.detail)}`,
    )
    parts.push(`HTF Trend: score ${b.htfTrend.score}/10 — ${formatDetail(b.htfTrend.detail)}`)
    parts.push(`Session: score ${b.session.score}/10 — ${formatDetail(b.session.detail)}`)
  }

  parts.push(`Recent signals on this pair (last 4h): ${ctx.recentSignalCount}`)
  parts.push(`Open auto-trades: ${ctx.openAutoTradeCount}`)
  parts.push(`Today's TV alert P&L: $${ctx.todayPL.toFixed(2)}`)

  if (ctx.recentWins > 0 || ctx.recentLosses > 0) {
    parts.push(`Recent pair results: ${ctx.recentWins}W / ${ctx.recentLosses}L`)
  }

  return parts.join("\n")
}

function formatDetail(detail: object): string {
  return Object.entries(detail as Record<string, unknown>)
    .filter(([k]) => k !== "directionMatch")
    .map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(2) : v}`)
    .join(", ")
}

function parseResponse(text: string): { execute: boolean; confidence: number; reason: string } {
  try {
    // Extract JSON from response (may have markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")
    const parsed = JSON.parse(jsonMatch[0]) as {
      execute?: boolean
      confidence?: number
      reason?: string
    }
    return {
      execute: parsed.execute === true,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 50,
      reason: typeof parsed.reason === "string" ? parsed.reason : "No reason provided",
    }
  } catch {
    // Parse failure — fail-open (allow the signal)
    console.warn("[ai-signal-filter] Failed to parse AI response, defaulting to allow")
    return {
      execute: true,
      confidence: 50,
      reason: "AI response parse failed — defaulting to allow",
    }
  }
}
