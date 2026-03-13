import { NextResponse, type NextRequest } from "next/server"
import { markActionFollowed } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
): Promise<NextResponse<ApiResponse<{ marked: boolean }>>> {
  try {
    const { analysisId } = await params
    await markActionFollowed(analysisId)
    return NextResponse.json({ ok: true, data: { marked: true } })
  } catch (error) {
    console.error("[POST /api/ai/recommendations/[analysisId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
