import { NextResponse } from "next/server"
import { testConnection } from "@fxflow/db"
import type { ApiResponse, TradingMode, TestConnectionResponse } from "@fxflow/types"

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<TestConnectionResponse>>> {
  try {
    const body = (await request.json()) as { mode: TradingMode }

    if (body.mode !== "live" && body.mode !== "practice") {
      return NextResponse.json(
        { ok: false, error: "Invalid mode. Must be 'live' or 'practice'" },
        { status: 400 },
      )
    }

    const result = await testConnection(body.mode)
    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("[POST /api/settings/oanda/test-connection]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
