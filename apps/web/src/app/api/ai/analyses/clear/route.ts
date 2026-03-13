import { NextResponse } from "next/server"
import { clearAllAnalyses } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function DELETE(): Promise<NextResponse<ApiResponse<{ count: number }>>> {
  try {
    const count = await clearAllAnalyses()
    return NextResponse.json({ ok: true, data: { count } })
  } catch (error) {
    console.error("[DELETE /api/ai/analyses/clear]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
