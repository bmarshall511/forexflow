import type {
  AiTraderConfigData,
  AiTraderStrategyPerformanceData,
  EconomicCalendarEvent,
  NewsSentimentData,
} from "@fxflow/types"
import type { Tier1Signal, TechnicalSnapshot } from "./strategy-engine.js"

// ─── System Prompts ──────────────────────────────────────────────────────────
//
// Two separate system prompts: Tier 2 (liberal triage) and Tier 3 (conservative
// final decision). A single "be conservative" prompt used to bias both tiers
// toward rejection, killing 99.86% of signals before Tier 3 ever ran.

const TIER2_SYSTEM_PROMPT = `You are a forex trading AI performing TRIAGE on trade candidates.

Your job is to decide which candidates deserve deeper analysis by a more expensive model. You are NOT making the final decision — that happens in Tier 3. Your role is to filter out obvious junk and forward everything else.

DEFAULT TO PASS. Only reject when there is a concrete, specific red flag that would make the trade clearly unprofitable. When in doubt, pass.

RESPOND ONLY WITH VALID JSON matching the schema. No markdown fences, no prose outside JSON.

ANTI-PATTERNS — do NOT use these as reasons to reject:
- Being in a kill zone (London 07-10 UTC, NY 12-15 UTC). Kill zones are PEAK LIQUIDITY and are generally favorable, not harmful.
- RSI in the 30-70 range. That is normal. Overbought is RSI > 70; oversold is RSI < 30. RSI 63 is just mildly bullish momentum, not overbought.
- Stochastic in the 20-80 range. 80+ is overbought; 20- is oversold. Stochastic 70 is mid-range.
- Williams %R between -80 and -20. That is normal.
- Secondary timeframe in a ranging regime while primary is trending. That is often a healthy pullback or consolidation — a good entry opportunity, not a conflict.
- "Volatility is high" during kill zones. High volatility is the reason pros trade kill zones.
- Missing indicators when other confluence is strong. Not every setup needs all 14 techniques present.

LEGITIMATE RED FLAGS — these ARE reasons to reject:
- Raw R:R below profile minimum (Scalper 1.3, Intraday 1.8, Swing 2.0, News 1.3).
- R:R after spread degrades by more than 40% AND spread-adjusted R:R is below 1.5.
- Direction directly opposite to a strong HTF trend AND no structural reversal reason present.
- Low volatility regime (ATR is effectively dead).
- Tier 1 confluence score below 40 (genuine lack of evidence).
- Multiple core confluence signals missing (e.g. no trend, no structure, no zone, no momentum).

Plain English only in the "reason" field. No jargon.`

const TIER3_SYSTEM_PROMPT = `You are a forex trading AI making the FINAL decision on whether to execute a trade.

You must respond ONLY with valid JSON matching the schema provided. No markdown, no explanation outside JSON.

CRITICAL RULES:
1. Be honest about confidence — do not inflate, do not deflate. A 70+ confidence trade should have multiple supporting reasons and no disqualifying red flags.
2. Consider the current market regime and session when scoring, but remember that kill zones (peak liquidity) are generally favorable, not unfavorable.
3. Factor in upcoming high-impact news events as risk only when they fall within the expected hold time.
4. Consider historical performance for similar setups when available.
5. Entry rationale must be specific with exact price levels.
6. All "reason" and "entryRationale" fields must be written in plain English that a beginner could understand. Avoid jargon and acronyms. Instead of "ADX at 16.0 confirms weak ranging regime", say "The market isn't trending strongly enough." Instead of "FVG confluence with OTE zone", say "Price is at a good entry level with multiple supporting signals."`

// ─── Tier 2: Quick Filter ────────────────────────────────────────────────────

export function buildTier2Prompt(signal: Tier1Signal): { system: string; user: string } {
  return {
    system: TIER2_SYSTEM_PROMPT,
    user: `## Tier 2 Triage

Decide whether this candidate deserves deeper Tier 3 analysis. Respond with JSON:

\`\`\`json
{
  "pass": boolean,        // true = forward to Tier 3; false = obvious red flag, skip deep analysis
  "confidence": number,   // 0-100 quick confidence estimate
  "reason": string        // 1-2 plain English sentences explaining the decision. No jargon or acronyms.
}
\`\`\`

DEFAULT TO PASS. Only return false when you can cite a specific red flag from the system prompt's "legitimate red flags" list.

### Candidate
- **Instrument**: ${signal.instrument}
- **Direction**: ${signal.direction.toUpperCase()}
- **Profile**: ${signal.profile}
- **Entry**: ${signal.entryPrice}
- **SL**: ${signal.suggestedSL} (${signal.riskPips.toFixed(1)} pips)
- **TP**: ${signal.suggestedTP} (${signal.rewardPips.toFixed(1)} pips)
- **R:R (raw)**: ${signal.riskRewardRatio.toFixed(2)}
- **R:R (after spread)**: ${signal.spreadAdjustedRR.toFixed(2)} (spread: ${signal.spreadPips.toFixed(1)} pips, ${(signal.spreadImpactPercent * 100).toFixed(0)}% R:R degradation)
- **Tier 1 Confluence Score**: ${signal.confidence}

### Technical Snapshot
${formatTechnicalSnapshot(signal.technicalSnapshot)}

### Confluence Signals
${signal.reasons.map((r) => `- ${r}`).join("\n")}

### Confluence Breakdown
${Object.entries(signal.confluenceBreakdown)
  .map(
    ([k, v]) =>
      `- ${k}: ${v.present ? "present" : "absent"} (weight: ${v.weight}, contribution: ${v.contribution.toFixed(1)})`,
  )
  .join("\n")}`,
  }
}

// ─── Tier 3: Deep Decision ───────────────────────────────────────────────────

export interface Tier3Context {
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
  /** Account risk percent from settings (defaults to 1% if not provided). */
  riskPercent?: number
  /** Number of consecutive losing trades (for self-awareness). */
  consecutiveLosses?: number
  /** Win rate for this specific pair+profile combo (null if no data). */
  pairProfileWinRate?: number | null
}

export function buildTier3Prompt(ctx: Tier3Context): { system: string; user: string } {
  const {
    signal,
    tier2Response,
    fundamentalData,
    performanceHistory,
    config,
    accountBalance,
    openTradeCount,
  } = ctx

  const riskPercent = ctx.riskPercent ?? 1
  const riskAmount = accountBalance * (riskPercent / 100)

  return {
    system: TIER3_SYSTEM_PROMPT,
    user: `## Tier 3 Deep Analysis — Final Trade Decision

You are making the FINAL decision on whether to execute this trade. Respond with JSON:

\`\`\`json
{
  "execute": boolean,
  "confidence": number,
  "adjustedEntry": number | null,
  "adjustedSL": number | null,
  "adjustedTP": number | null,
  "scores": {
    "technical": number,
    "fundamental": number,
    "sentiment": number,
    "session": number,
    "historical": number,
    "confluence": number
  },
  "entryRationale": string,
  "riskAssessment": string,
  "managementPlan": string
}
\`\`\`

### Candidate Details
- **Instrument**: ${signal.instrument}
- **Direction**: ${signal.direction.toUpperCase()}
- **Profile**: ${signal.profile}
- **Primary Technique**: ${signal.primaryTechnique}
- **Entry**: ${signal.entryPrice}
- **SL**: ${signal.suggestedSL} (${signal.riskPips.toFixed(1)} pips risk)
- **TP**: ${signal.suggestedTP} (${signal.rewardPips.toFixed(1)} pips reward)
- **R:R (raw)**: ${signal.riskRewardRatio.toFixed(2)}
- **R:R (after spread)**: ${signal.spreadAdjustedRR.toFixed(2)} (spread: ${signal.spreadPips.toFixed(1)} pips, ${(signal.spreadImpactPercent * 100).toFixed(0)}% R:R degradation)

### Tier 1 Confluence (${signal.confidence}/100)
${signal.reasons.map((r) => `- ${r}`).join("\n")}

### Tier 2 Assessment
${tier2Response}

### Technical Snapshot
${formatTechnicalSnapshot(signal.technicalSnapshot)}

### Fundamental Data
${formatFundamentals(fundamentalData)}

### Historical Performance (90d, similar setups)
${formatPerformance(performanceHistory)}

### Account Context
- Balance: $${accountBalance.toFixed(2)}
- Risk per trade: ${riskPercent}% = $${riskAmount.toFixed(2)}
- Open AI trades: ${openTradeCount} / ${config.maxConcurrentTrades} max
- Operating mode: ${config.operatingMode}

### Management Config
- Breakeven: ${config.managementConfig.breakevenEnabled ? `ON (trigger at ${config.managementConfig.breakevenTriggerRR}R)` : "OFF"}
- Trailing stop: ${config.managementConfig.trailingStopEnabled ? `ON (${config.managementConfig.trailingStopAtrMultiplier}x ATR)` : "OFF"}
- Partial close: ${config.managementConfig.partialCloseEnabled ? `ON (${config.managementConfig.partialClosePercent}% at ${config.managementConfig.partialCloseTargetRR}R)` : "OFF"}
- Time exit: ${config.managementConfig.timeExitEnabled ? `ON (${config.managementConfig.timeExitHours}h)` : "OFF"}
- News protection: ${config.managementConfig.newsProtectionEnabled ? "ON" : "OFF"}

${buildRiskWarning(ctx)}
IMPORTANT:
- Position sizing is calculated automatically by the system — do NOT include positionSizeUnits
- If adjusting entry/SL/TP, ensure R:R >= ${signal.profile === "scalper" || signal.profile === "news" ? "1.3" : signal.profile === "intraday" ? "1.8" : "2.0"}
- Factor in the spread impact on R:R — if spread degrades R:R by more than 25%, increase your risk assessment accordingly
- Confidence must be honest — 80+ should be truly exceptional setups
- entryRationale must cite specific price levels but use plain English, not jargon
- riskAssessment and managementPlan must also be in simple, clear language`,
  }
}

// ─── Re-evaluation Prompt ────────────────────────────────────────────────────

export interface ReEvalContext {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice: number
  currentSL: number
  currentTP: number
  unrealizedPL: number
  managementLog: Array<{ action: string; detail: string; timestamp: string }>
  snapshot: TechnicalSnapshot
  hoursOpen: number
}

export function buildReEvalPrompt(ctx: ReEvalContext): { system: string; user: string } {
  return {
    system: TIER3_SYSTEM_PROMPT,
    user: `## Trade Re-Evaluation

Evaluate this open AI trade and respond with JSON:

\`\`\`json
{
  "action": "hold" | "adjust_sl" | "adjust_tp" | "partial_close" | "close",
  "newSL": number | null,
  "newTP": number | null,
  "closePercent": number | null,
  "reason": string,
  "confidence": number
}
\`\`\`

### Open Trade
- **Instrument**: ${ctx.instrument}
- **Direction**: ${ctx.direction.toUpperCase()}
- **Entry**: ${ctx.entryPrice}
- **Current Price**: ${ctx.currentPrice}
- **SL**: ${ctx.currentSL}
- **TP**: ${ctx.currentTP}
- **Unrealized P&L**: $${ctx.unrealizedPL.toFixed(2)}
- **Hours open**: ${ctx.hoursOpen.toFixed(1)}

### Current Technical Snapshot
${formatTechnicalSnapshot(ctx.snapshot)}

### Management History
${ctx.managementLog.length > 0 ? ctx.managementLog.map((a) => `- [${a.timestamp}] ${a.action}: ${a.detail}`).join("\n") : "No actions taken yet."}

RULES:
- Only suggest adjustment if there's a clear technical reason
- Never widen SL (only tighten or hold)
- partial_close should specify closePercent (25, 50, 75)
- "close" only if the trade thesis is invalidated`,
  }
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatTechnicalSnapshot(s: TechnicalSnapshot): string {
  const lines: string[] = []
  if (s.rsi !== null) lines.push(`- RSI(14): ${s.rsi.toFixed(1)}`)
  if (s.macd)
    lines.push(
      `- MACD: ${s.macd.macdLine.toFixed(5)} / Signal: ${s.macd.signalLine.toFixed(5)} / Hist: ${s.macd.histogram.toFixed(5)}`,
    )
  if (s.ema20 !== null) lines.push(`- EMA20: ${s.ema20.toFixed(5)}`)
  if (s.ema50 !== null) lines.push(`- EMA50: ${s.ema50.toFixed(5)}`)
  if (s.ema200 !== null) lines.push(`- EMA200: ${s.ema200.toFixed(5)}`)
  if (s.bollingerBands)
    lines.push(
      `- BB: Upper ${s.bollingerBands.upper.toFixed(5)} / Mid ${s.bollingerBands.middle.toFixed(5)} / Lower ${s.bollingerBands.lower.toFixed(5)} (Width: ${s.bollingerBands.bandwidth.toFixed(5)})`,
    )
  if (s.williamsR !== null) lines.push(`- Williams %R: ${s.williamsR.toFixed(1)}`)
  if (s.adx)
    lines.push(
      `- ADX: ${s.adx.adx.toFixed(1)} (+DI: ${s.adx.plusDI.toFixed(1)}, -DI: ${s.adx.minusDI.toFixed(1)})`,
    )
  if (s.stochastic)
    lines.push(`- Stochastic: K=${s.stochastic.k.toFixed(1)} D=${s.stochastic.d.toFixed(1)}`)
  if (s.atr !== null) lines.push(`- ATR(14): ${s.atr.toFixed(5)}`)
  if (s.regime) lines.push(`- Regime: ${s.regime}`)
  if (s.session) lines.push(`- Session: ${s.session}${s.isKillZone ? " (Kill Zone)" : ""}`)
  // Multi-timeframe context
  if (s.htfEma20 !== null) lines.push(`- HTF EMA20: ${s.htfEma20.toFixed(5)}`)
  if (s.htfEma50 !== null) lines.push(`- HTF EMA50: ${s.htfEma50.toFixed(5)}`)
  if (s.htfTrendBullish !== null)
    lines.push(`- HTF Trend: ${s.htfTrendBullish ? "Bullish" : "Bearish"}`)
  if (s.secondaryRsi !== null) lines.push(`- Secondary TF RSI: ${s.secondaryRsi.toFixed(1)}`)
  if (s.secondaryRegime) lines.push(`- Secondary TF Regime: ${s.secondaryRegime}`)
  return lines.join("\n")
}

function formatFundamentals(data: {
  calendar: EconomicCalendarEvent[]
  sentiment: Record<string, NewsSentimentData | null>
  macro: Record<string, unknown>
}): string {
  const lines: string[] = []

  // Calendar
  if (data.calendar.length > 0) {
    lines.push("**Upcoming Events:**")
    for (const e of data.calendar.slice(0, 5)) {
      lines.push(`- [${e.impact.toUpperCase()}] ${e.currency} ${e.title} @ ${e.timestamp}`)
    }
  } else {
    lines.push("No significant upcoming events.")
  }

  // Sentiment
  lines.push("\n**Sentiment:**")
  for (const [currency, s] of Object.entries(data.sentiment)) {
    if (s) {
      lines.push(`- ${currency}: ${s.sentiment} (score: ${s.score}, ${s.articleCount} articles)`)
    } else {
      lines.push(`- ${currency}: No data available`)
    }
  }

  return lines.join("\n")
}

function formatPerformance(history: AiTraderStrategyPerformanceData[]): string {
  if (history.length === 0) return "No historical performance data for this setup type."

  const lines: string[] = []
  for (const h of history.slice(0, 3)) {
    const label = [h.profile, h.instrument ?? "all", h.session ?? "all"].join(" / ")
    lines.push(
      `- ${label}: ${h.totalTrades} trades, ${(h.winRate * 100).toFixed(0)}% WR, PF ${h.profitFactor.toFixed(2)}, Exp $${h.expectancy.toFixed(2)}`,
    )
  }
  return lines.join("\n")
}

function buildRiskWarning(ctx: Tier3Context): string {
  const lines: string[] = []
  const losses = ctx.consecutiveLosses ?? 0
  const winRate = ctx.pairProfileWinRate

  if (losses >= 2 || (winRate !== null && winRate !== undefined && winRate < 0.4)) {
    lines.push("### Risk Warning")
    lines.push(`- Consecutive losses: ${losses}`)
    if (winRate !== null && winRate !== undefined) {
      lines.push(`- This pair+profile win rate: ${(winRate * 100).toFixed(0)}%`)
    }
    if (losses >= 2) {
      lines.push(
        "CAUTION: We are in a losing streak. Be more conservative. Only approve high-confidence setups with 3+ strong reasons.",
      )
    }
    if (winRate !== null && winRate !== undefined && winRate < 0.4) {
      lines.push(
        "WARNING: This pair+profile combination has a poor track record. Consider rejecting unless the setup is exceptional.",
      )
    }
    lines.push("")
  }

  return lines.join("\n")
}
