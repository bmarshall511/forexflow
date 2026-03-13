import { NextResponse, type NextRequest } from "next/server"
import { getAnalysis, deleteAnalysis } from "@fxflow/db"
import type { ApiResponse, AiAnalysisData } from "@fxflow/types"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string; analysisId: string }> },
): Promise<NextResponse<ApiResponse<AiAnalysisData>>> {
  try {
    const { analysisId } = await params
    const analysis = await getAnalysis(analysisId)
    if (!analysis) {
      return NextResponse.json({ ok: false, error: "Analysis not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: analysis })
  } catch (error) {
    console.error("[GET /api/ai/analyses/[tradeId]/[analysisId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string; analysisId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { analysisId } = await params
    await deleteAnalysis(analysisId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/ai/analyses/[tradeId]/[analysisId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
