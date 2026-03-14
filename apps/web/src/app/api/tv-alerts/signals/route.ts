import { NextResponse, type NextRequest } from "next/server"
import { listSignals, clearAllSignals } from "@fxflow/db"
import type { ApiResponse, TVSignalListResponse } from "@fxflow/types"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TVSignalListResponse>>> {
  try {
    const params = request.nextUrl.searchParams

    // Validate and clamp pagination params
    const rawPage = parseInt(params.get("page") ?? "1", 10)
    const rawPageSize = parseInt(params.get("pageSize") ?? "20", 10)
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage)
    const pageSize = Math.min(100, Math.max(1, isNaN(rawPageSize) ? 20 : rawPageSize))

    const status = params.get("status") ?? undefined
    const instrument = params.get("instrument") ?? undefined
    const source = params.get("source") ?? undefined

    // Validate date params
    const rawDateFrom = params.get("dateFrom")
    const rawDateTo = params.get("dateTo")
    const dateFrom = rawDateFrom ? new Date(rawDateFrom) : undefined
    const dateTo = rawDateTo ? new Date(rawDateTo) : undefined

    // Reject invalid dates
    if (dateFrom && isNaN(dateFrom.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid dateFrom" }, { status: 400 })
    }
    if (dateTo && isNaN(dateTo.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid dateTo" }, { status: 400 })
    }

    const result = await listSignals({
      page,
      pageSize,
      status,
      instrument,
      source,
      dateFrom,
      dateTo,
    })
    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("[GET /api/tv-alerts/signals]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(): Promise<NextResponse<ApiResponse<{ deleted: number }>>> {
  try {
    const deleted = await clearAllSignals()
    return NextResponse.json({ ok: true, data: { deleted } })
  } catch (error) {
    console.error("[DELETE /api/tv-alerts/signals]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
