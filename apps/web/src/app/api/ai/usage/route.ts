import { NextResponse } from "next/server"
import { getUsageStats } from "@fxflow/db"
import type { ApiResponse, AiUsageStats } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<AiUsageStats>>> {
  try {
    const stats = await getUsageStats()
    return NextResponse.json({ ok: true, data: stats })
  } catch (error) {
    console.error("[GET /api/ai/usage]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
