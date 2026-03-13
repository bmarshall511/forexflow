import { NextResponse, type NextRequest } from "next/server"
import { getTradeWithDetails, updateTradeNotes, updateTradeTimeframe, deleteTrade } from "@fxflow/db"
import type { ApiResponse, TradeDetailData } from "@fxflow/types"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<TradeDetailData>>> {
  try {
    const { tradeId } = await params
    const detail = await getTradeWithDetails(tradeId)
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Trade not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    console.error("[GET /api/trades/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { tradeId } = await params
    const body = (await request.json()) as { notes?: string; timeframe?: string | null }
    if (body.notes !== undefined) {
      await updateTradeNotes(tradeId, body.notes)
    }
    if (body.timeframe !== undefined) {
      await updateTradeTimeframe(tradeId, body.timeframe)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[PATCH /api/trades/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { tradeId } = await params
    await deleteTrade(tradeId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/trades/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
