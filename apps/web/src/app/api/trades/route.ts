import { NextResponse, type NextRequest } from "next/server"
import { listTrades, deleteClosedTrades, type TradeListResponse } from "@fxflow/db"
import type { ApiResponse, TradeDirection, TradeOutcome, TradeStatus } from "@fxflow/types"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TradeListResponse>>> {
  try {
    const { searchParams } = request.nextUrl

    const status = searchParams.get("status") as TradeStatus | null
    const instrument = searchParams.get("instrument")
    const direction = searchParams.get("direction") as TradeDirection | null
    const outcome = searchParams.get("outcome") as TradeOutcome | null
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const tags = searchParams.get("tags")
    const sort = searchParams.get("sort")
    const order = searchParams.get("order") as "asc" | "desc" | null
    const page = searchParams.get("page")
    const limit = searchParams.get("limit")

    const pageNum = page ? parseInt(page, 10) : 1
    const limitNum = limit ? parseInt(limit, 10) : 20
    const offset = (pageNum - 1) * limitNum

    const result = await listTrades({
      status: status ?? undefined,
      instrument: instrument ?? undefined,
      direction: direction ?? undefined,
      outcome: outcome ?? undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      tagIds: tags ? tags.split(",").filter(Boolean) : undefined,
      sort: sort ?? undefined,
      order: order ?? undefined,
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
