import { NextResponse } from "next/server"
import { revealToken } from "@fxflow/db"
import type { ApiResponse, TradingMode } from "@fxflow/types"

export async function GET(request: Request): Promise<NextResponse<ApiResponse<{ token: string }>>> {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode") as TradingMode | null

    if (mode !== "live" && mode !== "practice") {
      return NextResponse.json(
        { ok: false, error: "Invalid mode query parameter" },
        { status: 400 },
      )
    }

    const token = await revealToken(mode)
    return NextResponse.json({ ok: true, data: { token } })
  } catch (error) {
    console.error("[GET /api/settings/oanda/credentials/token]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
