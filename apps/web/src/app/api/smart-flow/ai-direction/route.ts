import { type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getAiSettings, getDecryptedClaudeKey } from "@fxflow/db"
import { z } from "zod"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"

const BodySchema = z.object({
  instrument: z.string().min(1),
  includeStrategy: z.boolean().optional(),
})

const SYSTEM_PROMPT = `You are a senior forex market analyst helping a beginner trader. Given a currency pair, analyze current macro conditions, typical seasonal patterns, interest rate differentials, and recent trend behavior to suggest a directional bias and optimal trading strategy.

Respond ONLY with valid JSON in this exact format:
{
  "direction": "long" or "short",
  "confidence": number between 40-85 (be realistic, never claim certainty),
  "reasoning": ["bullet 1", "bullet 2", "bullet 3"],
  "factors": ["factor1", "factor2", "factor3"],
  "suggestedStrategy": "momentum_catch" | "steady_growth" | "swing_capture" | "trend_rider",
  "strategyReason": "One sentence explaining why this strategy suits current conditions"
}

Strategy guidance:
- "momentum_catch": Use when there's short-term momentum, quick moves expected, clear short-term catalysts
- "steady_growth": Default/safest choice. Use when market is calm, no major events, clear but moderate trend
- "swing_capture": Use when there's a strong multi-day trend forming, good support/resistance levels visible
- "trend_rider": Use when there's a strong established trend with no signs of reversal, major fundamental shift

Rules:
- reasoning: 3 concise bullet points explaining your analysis (max 15 words each, simple language a teenager would understand)
- factors: 3 key data points you considered (e.g. "USD strength", "EUR rate outlook")
- Be balanced and honest. If the signal is weak, reflect that in a lower confidence score
- Never exceed 85% confidence — markets are inherently uncertain
- Never suggest "recovery" strategy — that's for advanced users only`

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, BodySchema)
    if (!parsed.success) return parsed.response

    const { instrument } = parsed.data
    const settings = await getAiSettings()

    if (!settings.hasClaudeKey) {
      return apiError("Claude API key not configured. Set it up in Settings > AI.", 400)
    }

    const apiKey = await getDecryptedClaudeKey()
    if (!apiKey) {
      return apiError("Failed to decrypt Claude API key.", 500)
    }

    const pairLabel = instrument.replace("_", "/")
    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze ${pairLabel} and suggest a directional bias and optimal strategy for a new trade entry right now.`,
        },
      ],
    })

    const text = message.content[0]?.type === "text" ? message.content[0].text : ""

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return apiError("AI returned an unexpected response format.", 500)
    }

    const result = JSON.parse(jsonMatch[0]) as {
      direction: "long" | "short"
      confidence: number
      reasoning: string[]
      factors: string[]
      suggestedStrategy?: string
      strategyReason?: string
    }

    if (
      !["long", "short"].includes(result.direction) ||
      typeof result.confidence !== "number" ||
      !Array.isArray(result.reasoning) ||
      !Array.isArray(result.factors)
    ) {
      return apiError("AI response did not match expected format.", 500)
    }

    result.confidence = Math.max(30, Math.min(85, Math.round(result.confidence)))

    // Validate strategy suggestion
    const validStrategies = ["momentum_catch", "steady_growth", "swing_capture", "trend_rider"]
    if (!result.suggestedStrategy || !validStrategies.includes(result.suggestedStrategy)) {
      result.suggestedStrategy = "steady_growth"
      result.strategyReason = "Steady Growth is the safest default for current conditions."
    }

    return apiSuccess(result)
  } catch (error) {
    console.error("[POST /api/smart-flow/ai-direction]", error)
    const msg = error instanceof Error ? error.message : "Unknown error"
    return apiError(`AI analysis failed: ${msg}`, 500)
  }
}
