import Anthropic from "@anthropic-ai/sdk"
import type { AiDigestSections, AiAutoAnalysisSettings } from "@fxflow/types"

/**
 * Periodically checks if a weekly/monthly digest should be generated.
 * Runs on an hourly timer, generating digests at 00:00-01:00 UTC
 * on the appropriate day (Monday for weekly, 1st for monthly).
 */
export class DigestGenerator {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  start(): void {
    // Check every hour
    this.timer = setInterval(() => void this.checkSchedule(), 60 * 60 * 1000)
    // Also check shortly after start
    setTimeout(() => void this.checkSchedule(), 5000)
    console.log("[digest-generator] Started")
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    console.log("[digest-generator] Stopped")
  }

  private async checkSchedule(): Promise<void> {
    if (this.running) return

    try {
      const { getAiSettings } = await import("@fxflow/db")
      const settings = await getAiSettings()
      const autoSettings = settings.autoAnalysis as AiAutoAnalysisSettings
      if (!autoSettings.digestEnabled) return

      const now = new Date()
      const utcHour = now.getUTCHours()
      const utcDay = now.getUTCDay() // 0=Sunday, 1=Monday
      const utcDate = now.getUTCDate()

      // Only run between 00:00-01:00 UTC
      if (utcHour !== 0) return

      const frequency = autoSettings.digestFrequency ?? "weekly"

      // Weekly: Monday
      if ((frequency === "weekly" || frequency === "both") && utcDay === 1) {
        const periodEnd = new Date(now)
        periodEnd.setUTCHours(0, 0, 0, 0)
        const periodStart = new Date(periodEnd)
        periodStart.setUTCDate(periodStart.getUTCDate() - 7)

        const { findExistingDigest } = await import("@fxflow/db")
        const existing = await findExistingDigest("weekly", periodStart)
        if (!existing) {
          await this.generateDigest("weekly", periodStart, periodEnd)
        }
      }

      // Monthly: 1st of month
      if ((frequency === "monthly" || frequency === "both") && utcDate === 1) {
        const periodEnd = new Date(now)
        periodEnd.setUTCHours(0, 0, 0, 0)
        const periodStart = new Date(periodEnd)
        periodStart.setUTCMonth(periodStart.getUTCMonth() - 1)

        const { findExistingDigest } = await import("@fxflow/db")
        const existing = await findExistingDigest("monthly", periodStart)
        if (!existing) {
          await this.generateDigest("monthly", periodStart, periodEnd)
        }
      }
    } catch (error) {
      console.error("[digest-generator] Schedule check failed:", error)
    }
  }

  async generateDigest(
    period: "weekly" | "monthly",
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    this.running = true
    const startTime = Date.now()
    let digestId: string | null = null

    try {
      console.log(
        `[digest-generator] Generating ${period} digest for ${periodStart.toISOString()} - ${periodEnd.toISOString()}`,
      )

      const { createDigest, saveDigestResult, db, getDecryptedClaudeKey, calculateCost } =
        await import("@fxflow/db")

      digestId = await createDigest({ period, periodStart, periodEnd })

      // 1. Query all closed trades in period
      const trades = await db.trade.findMany({
        where: {
          status: "closed",
          closedAt: { gte: periodStart, lt: periodEnd },
        },
        select: {
          id: true,
          instrument: true,
          direction: true,
          entryPrice: true,
          exitPrice: true,
          realizedPL: true,
          openedAt: true,
          closedAt: true,
          initialUnits: true,
          stopLoss: true,
          takeProfit: true,
          closeReason: true,
          financing: true,
        },
      })

      if (trades.length === 0) {
        await saveDigestResult(digestId, {
          status: "completed",
          sections: {
            periodSummary: `No trades were closed during this ${period} period.`,
            totalTrades: 0,
            winRate: 0,
            totalPnl: 0,
            bestPair: null,
            worstPair: null,
            bestSession: null,
            worstSession: null,
            patterns: [],
            mistakes: [],
            improvements: ["Start placing trades to get personalized insights!"],
            riskManagement: "No trades to assess.",
            emotionalPatterns: null,
            goalSuggestion: "Focus on identifying high-quality setups and practicing your entries.",
          },
          durationMs: Date.now() - startTime,
        })
        console.log(`[digest-generator] ${period} digest completed (no trades)`)
        this.running = false
        return
      }

      // 2. Calculate aggregates
      const totalPnl = trades.reduce((sum, t) => sum + t.realizedPL, 0)
      const wins = trades.filter((t) => t.realizedPL > 0)
      const losses = trades.filter((t) => t.realizedPL <= 0)
      const winRate = trades.length > 0 ? wins.length / trades.length : 0

      // PnL by instrument
      const byInstrument = new Map<string, { pnl: number; trades: number }>()
      for (const t of trades) {
        const entry = byInstrument.get(t.instrument) ?? { pnl: 0, trades: 0 }
        entry.pnl += t.realizedPL
        entry.trades++
        byInstrument.set(t.instrument, entry)
      }

      // Session classification
      const bySession = new Map<string, { pnl: number; count: number }>()
      for (const t of trades) {
        const hour = t.openedAt.getUTCHours()
        const session = hour < 7 ? "Asian" : hour < 13 ? "London" : hour < 21 ? "New York" : "Late"
        const entry = bySession.get(session) ?? { pnl: 0, count: 0 }
        entry.pnl += t.realizedPL
        entry.count++
        bySession.set(session, entry)
      }

      // 3. Query AI analyses in period for cost data
      const analyses = await db.aiAnalysis.findMany({
        where: {
          createdAt: { gte: periodStart, lt: periodEnd },
          status: "completed",
        },
        select: { inputTokens: true, outputTokens: true, costUsd: true },
      })

      const totalAiCost = analyses.reduce((sum, a) => sum + a.costUsd, 0)

      // 4. Build context for Claude
      const bestPairEntry = [...byInstrument.entries()].sort((a, b) => b[1].pnl - a[1].pnl)[0]
      const worstPairEntry = [...byInstrument.entries()].sort((a, b) => a[1].pnl - b[1].pnl)[0]
      const bestSessionEntry = [...bySession.entries()].sort((a, b) => b[1].pnl - a[1].pnl)[0]
      const worstSessionEntry = [...bySession.entries()].sort((a, b) => a[1].pnl - b[1].pnl)[0]

      const contextMessage = `
Generate a ${period} trading digest for the period ${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}.

## Trading Statistics
- Total trades: ${trades.length}
- Wins: ${wins.length} (${(winRate * 100).toFixed(1)}%)
- Losses: ${losses.length}
- Total P&L: $${totalPnl.toFixed(2)}
- Average win: $${wins.length > 0 ? (wins.reduce((s, t) => s + t.realizedPL, 0) / wins.length).toFixed(2) : "0"}
- Average loss: $${losses.length > 0 ? (losses.reduce((s, t) => s + t.realizedPL, 0) / losses.length).toFixed(2) : "0"}
- Total AI analysis cost: $${totalAiCost.toFixed(2)}

## By Instrument
${[...byInstrument.entries()].map(([inst, data]) => `- ${inst}: ${data.trades} trades, P&L $${data.pnl.toFixed(2)}`).join("\n")}

## By Session
${[...bySession.entries()].map(([session, data]) => `- ${session}: ${data.count} trades, P&L $${data.pnl.toFixed(2)}`).join("\n")}

## Trade Details
${trades.map((t) => `- ${t.instrument} ${t.direction} | Entry: ${t.entryPrice} Exit: ${t.exitPrice ?? "?"} | P&L: $${t.realizedPL.toFixed(2)} | Close: ${t.closeReason ?? "manual"} | SL: ${t.stopLoss ?? "none"} TP: ${t.takeProfit ?? "none"}`).join("\n")}

Analyze these results and provide your digest response as JSON.
`

      // 5. Get Claude API key (decrypted, same pattern as analysis-executor)
      const apiKey = await getDecryptedClaudeKey()
      if (!apiKey) {
        throw new Error("Claude API key not configured")
      }

      const client = new Anthropic({ apiKey })

      const systemPrompt = `You are an expert forex trading coach generating a ${period} performance digest.
Your audience is a retail forex trader who may be a complete beginner.
Respond ONLY with a valid JSON object matching this schema:
{
  "periodSummary": "2-3 sentence overview of the period",
  "totalTrades": number,
  "winRate": number (0-1),
  "totalPnl": number,
  "bestPair": { "instrument": string, "pnl": number, "trades": number } | null,
  "worstPair": { "instrument": string, "pnl": number, "trades": number } | null,
  "bestSession": string | null,
  "worstSession": string | null,
  "patterns": ["identified trading pattern 1", ...],
  "mistakes": ["common mistake 1", ...],
  "improvements": ["actionable improvement 1", ...],
  "riskManagement": "assessment of risk management",
  "emotionalPatterns": "any emotional patterns detected (revenge trading, overtrading, etc.) or null",
  "goalSuggestion": "what to focus on next period"
}

Rules:
- Be honest but encouraging. Point out mistakes clearly but frame them as learning opportunities.
- Use language a 13-year-old could understand.
- Patterns, mistakes, and improvements should be specific to this trader's data, not generic advice.
- If there are fewer than 5 trades, acknowledge limited data and focus on what you can observe.
- Look for: overtrading, revenge trading, not using stop losses, cutting winners short, letting losers run, session-specific patterns, instrument preferences.`

      const model = "claude-sonnet-4-6" as const

      const response = await client.messages.create({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: contextMessage }],
      })

      let rawResponse = ""
      for (const block of response.content) {
        if (block.type === "text") {
          rawResponse += block.text
        }
      }

      // Parse JSON from response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("Failed to extract JSON from digest response")
      }

      const sections = JSON.parse(jsonMatch[0]) as AiDigestSections

      // Fill in computed values (override any AI hallucination with actual data)
      sections.totalTrades = trades.length
      sections.winRate = winRate
      sections.totalPnl = totalPnl
      sections.bestPair = bestPairEntry
        ? {
            instrument: bestPairEntry[0],
            pnl: bestPairEntry[1].pnl,
            trades: bestPairEntry[1].trades,
          }
        : null
      sections.worstPair = worstPairEntry
        ? {
            instrument: worstPairEntry[0],
            pnl: worstPairEntry[1].pnl,
            trades: worstPairEntry[1].trades,
          }
        : null
      sections.bestSession = bestSessionEntry?.[0] ?? null
      sections.worstSession = worstSessionEntry?.[0] ?? null

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const costUsd = calculateCost(model, inputTokens, outputTokens)

      await saveDigestResult(digestId, {
        status: "completed",
        sections,
        rawResponse,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs: Date.now() - startTime,
      })

      console.log(`[digest-generator] ${period} digest completed in ${Date.now() - startTime}ms`)
    } catch (error) {
      console.error(`[digest-generator] ${period} digest failed:`, error)
      if (digestId) {
        const { saveDigestResult } = await import("@fxflow/db")
        await saveDigestResult(digestId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - startTime,
        }).catch(() => {})
      }
    } finally {
      this.running = false
    }
  }
}
