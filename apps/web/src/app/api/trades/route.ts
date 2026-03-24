import { NextResponse, type NextRequest } from "next/server"
import { listTrades, deleteClosedTrades, type TradeListResponse } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"
import { parseSearchParams } from "@/lib/api-validation"
import { tradeListParamsSchema } from "@/lib/api-schemas"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TradeListResponse>>> {
  try {
    const parsed = parseSearchParams(request.nextUrl.searchParams, tradeListParamsSchema)
    if (!parsed.success) return parsed.response

    const { status, instrument, direction, outcome, from, to, tags, sort, order } = parsed.data
    const pageNum = parsed.data.page ?? 1
    const limitNum = parsed.data.limit ?? 20
    const offset = (pageNum - 1) * limitNum

    const result = await listTrades({
      status,
      instrument,
      direction,
      outcome,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      tagIds: tags ? tags.split(",").filter(Boolean) : undefined,
      sort,
      order,
      limit: limitNum,
      offset,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("[GET /api/trades]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: NextRequest,
): Promise<NextResponse<ApiResponse<{ count: number }>>> {
  try {
    const result = await deleteClosedTrades()
    return NextResponse.json({ ok: true, data: { count: result.count } })
  } catch (error) {
    console.error("[DELETE /api/trades]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
