import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"

export async function POST(): Promise<NextResponse<ApiResponse<{ count: number }>>> {
  try {
    const { resetStuckAnalyses } = await import("@fxflow/db")
    const count = await resetStuckAnalyses()
    return NextResponse.json({ ok: true, data: { count } })
  } catch (error) {
    console.error("[POST /api/ai/analyses/reset-stuck]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
