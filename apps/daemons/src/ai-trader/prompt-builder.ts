import type {
  AiTraderConfigData,
  AiTraderStrategyPerformanceData,
  EconomicCalendarEvent,
  NewsSentimentData,
} from "@fxflow/types"
import type { Tier1Signal, TechnicalSnapshot } from "./strategy-engine.js"

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a forex trading AI that analyzes currency pair setups.

You must respond ONLY with valid JSON matching the schema provided. No markdown, no explanation outside JSON.

CRITICAL RULES:
1. Be conservative — never inflate confidence. A 70+ confidence trade should have 3+ strong confluent reasons.
2. Always consider the current market regime and session when scoring.
3. Factor in upcoming high-impact news events as risk.
4. Consider historical performance for similar setups when available.
5. Entry rationale must be specific with exact price levels.
6. IMPORTANT: All "reason" and "entryRationale" fields must be written in plain English that a beginner could understand. Avoid jargon and acronyms. Instead of "ADX at 16.0 confirms weak ranging regime", say "The market isn't trending strongly enough." Instead of "FVG confluence with OTE zone", say "Price is at a good entry level with multiple supporting signals."`

// ─── Tier 2: Quick Filter ────────────────────────────────────────────────────

export function buildTier2Prompt(signal: Tier1Signal): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: `## Tier 2 Quick Assessment

Assess this trade candidate and respond with JSON:

\`\`\`json
{
  "pass": boolean,        // true if worth deeper analysis
  "confidence": number,   // 0-100 quick confidence estimate
  "reason": string        // 1-2 plain English sentences a beginner would understand. No jargon or acronyms.
}
\`\`\`

### Candidate
- **Instrument**: ${signal.instrument}
- **Direction**: ${signal.direction.toUpperCase()}
- **Profile**: ${signal.profile}
- **Entry**: ${signal.entryPrice}
- **SL**: ${signal.suggestedSL} (${signal.riskPips.toFixed(1)} pips)
- **TP**: ${signal.suggestedTP} (${signal.rewardPips.toFixed(1)} pips)
- **R:R**: ${signal.riskRewardRatio.toFixed(2)}
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

  const riskPercent = 1 // Default 1% risk per trade
  const riskAmount = accountBalance * (riskPercent / 100)

  return {
    system: SYSTEM_PROMPT,
    user: `## Tier 3 Deep Analysis — Final Trade Decision

You are making the FINAL decision on whether to execute this trade. Respond with JSON:

\`\`\`json
{
  "execute": boolean,
  "confidence": number,
  "adjustedEntry": number | null,
  "adjustedSL": number | null,
  "adjustedTP": number | null,
  "positionSizeUnits": number,
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
- **R:R**: ${signal.riskRewardRatio.toFixed(2)}

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

IMPORTANT:
- Set positionSizeUnits based on $${riskAmount.toFixed(2)} risk and the SL distance
- If adjusting entry/SL/TP, ensure R:R >= ${signal.profile === "scalper" ? "1.5" : signal.profile === "intraday" ? "2.0" : "2.5"}
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
    system: SYSTEM_PROMPT,
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
