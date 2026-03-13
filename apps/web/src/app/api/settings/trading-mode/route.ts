import { NextResponse } from "next/server"
import { setTradingMode } from "@fxflow/db"
import type { ApiResponse, UpdateTradingModeRequest } from "@fxflow/types"

export async function PUT(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = (await request.json()) as UpdateTradingModeRequest

    if (body.mode !== "live" && body.mode !== "practice") {
      return NextResponse.json(
        { ok: false, error: "Invalid mode. Must be 'live' or 'practice'" },
        { status: 400 },
      )
    }

    await setTradingMode(body.mode)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[PUT /api/settings/trading-mode]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
