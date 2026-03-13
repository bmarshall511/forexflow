import { NextResponse } from "next/server"
import { getAccuracyStats } from "@fxflow/db"
import type { ApiResponse, AiAccuracyStats } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<AiAccuracyStats>>> {
  try {
    const stats = await getAccuracyStats()
    return NextResponse.json({ ok: true, data: stats })
  } catch (error) {
    console.error("[GET /api/ai/accuracy]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
