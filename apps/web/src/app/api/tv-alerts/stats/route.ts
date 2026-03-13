import { NextResponse, type NextRequest } from "next/server"
import { getSignalPerformanceStats } from "@fxflow/db"
import type { ApiResponse, TVSignalPerformanceStats } from "@fxflow/types"

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<TVSignalPerformanceStats>>> {
  try {
    const params = request.nextUrl.searchParams
    const from = params.get("from") ? new Date(params.get("from")!) : undefined
    const to = params.get("to") ? new Date(params.get("to")!) : undefined

    const stats = await getSignalPerformanceStats({ from, to })
    return NextResponse.json({ ok: true, data: stats })
  } catch (error) {
    console.error("[GET /api/tv-alerts/stats]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
