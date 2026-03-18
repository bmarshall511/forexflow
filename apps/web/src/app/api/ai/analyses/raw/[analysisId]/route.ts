import { NextResponse, type NextRequest } from "next/server"
import { getAnalysisRawResponse } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
): Promise<NextResponse<ApiResponse<{ rawResponse: string | null }>>> {
  try {
    const { analysisId } = await params
    const rawResponse = await getAnalysisRawResponse(analysisId)
    return NextResponse.json({ ok: true, data: { rawResponse } })
  } catch (error) {
    console.error("[GET /api/ai/analyses/raw/[analysisId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
