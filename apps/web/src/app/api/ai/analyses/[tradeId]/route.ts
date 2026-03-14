import { NextResponse, type NextRequest } from "next/server"
import { getAnalysisHistory, getTradeWithDetails, getAiSettings } from "@fxflow/db"
import type { ApiResponse, AiAnalysisData, AiClaudeModel, AiAnalysisDepth } from "@fxflow/types"
import { AI_AUTO_ANALYSIS_DEFAULTS } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<AiAnalysisData[]>>> {
  try {
    const { tradeId } = await params
    const history = await getAnalysisHistory(tradeId)
    return NextResponse.json({ ok: true, data: history })
  } catch (error) {
    console.error("[GET /api/ai/analyses/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<{ analysisId: string }>>> {
  try {
    const { tradeId } = await params
    const body = (await request.json()) as {
      model?: AiClaudeModel
      depth?: AiAnalysisDepth
    }

    // Look up trade status — daemon needs it to record the snapshot
    const trade = await getTradeWithDetails(tradeId)
    if (!trade) {
      return NextResponse.json({ ok: false, error: "Trade not found" }, { status: 404 })
    }

    // Fetch user's default model from AI settings (fallback to canonical default)
    let defaultModel = AI_AUTO_ANALYSIS_DEFAULTS.defaultModel
    let defaultDepth = AI_AUTO_ANALYSIS_DEFAULTS.defaultDepth
    try {
      const aiSettings = await getAiSettings()
      defaultModel = aiSettings.autoAnalysis.defaultModel ?? defaultModel
      defaultDepth = aiSettings.autoAnalysis.defaultDepth ?? defaultDepth
    } catch {
      // Use defaults if settings fetch fails
    }

    // Delegate entirely to daemon — it creates the DB record and executes the analysis
    const daemonRes = await fetch(`${DAEMON_URL}/actions/ai/analyze/${tradeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: body.model ?? defaultModel,
        depth: body.depth ?? defaultDepth,
        triggeredBy: "user",
        tradeStatus: trade.status,
      }),
    })

    if (!daemonRes.ok) {
      const err = (await daemonRes.json().catch(() => ({ error: "Daemon error" }))) as {
        error?: string
      }
      return NextResponse.json(
        { ok: false, error: err.error ?? "Failed to start analysis" },
        { status: daemonRes.status },
      )
    }

    const result = (await daemonRes.json()) as { ok: boolean; data?: { analysisId: string } }
    if (!result.ok || !result.data) {
      return NextResponse.json(
        { ok: false, error: "Daemon did not return analysisId" },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, data: { analysisId: result.data.analysisId } })
  } catch (error) {
    console.error("[POST /api/ai/analyses/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
