import { NextResponse, type NextRequest } from "next/server"
import { getAiSettings, saveClaudeApiKey, saveFinnhubApiKey, deleteClaudeApiKey, deleteFinnhubApiKey, saveAiPreferences, clearAutoDisableReason } from "@fxflow/db"
import type { ApiResponse, AiSettingsData } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<AiSettingsData>>> {
  try {
    const settings = await getAiSettings()
    return NextResponse.json({ ok: true, data: settings })
  } catch (error) {
    console.error("[GET /api/ai/settings]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<AiSettingsData>>> {
  try {
    const body = await request.json() as {
      action?: string
      claudeApiKey?: string | null
      finnhubApiKey?: string | null
      preferences?: Record<string, unknown>
    }

    // Handle re-enable auto-analysis action
    if (body.action === "re-enable-auto") {
      await clearAutoDisableReason()
      await saveAiPreferences({ autoAnalysis: { enabled: true } as never })
      const settings = await getAiSettings()
      return NextResponse.json({ ok: true, data: settings })
    }

    if (body.claudeApiKey === null) {
      await deleteClaudeApiKey()
    } else if (body.claudeApiKey) {
      await saveClaudeApiKey(body.claudeApiKey)
    }

    if (body.finnhubApiKey === null) {
      await deleteFinnhubApiKey()
    } else if (body.finnhubApiKey) {
      await saveFinnhubApiKey(body.finnhubApiKey)
    }

    if (body.preferences) {
      // All preferences (including defaultModel, defaultDepth, toggles) live in
      // autoAnalysisJson — pass as autoAnalysis so they merge into the JSON blob
      // and are correctly returned by getAiSettings().
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await saveAiPreferences({ autoAnalysis: body.preferences as any })
    }

    const settings = await getAiSettings()
    return NextResponse.json({ ok: true, data: settings })
  } catch (error) {
    console.error("[PUT /api/ai/settings]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
