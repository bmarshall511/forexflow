import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function POST(request: Request): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const body = (await request.json()) as { sourceTradeId?: string }
    const { sourceTradeId } = body

    if (!sourceTradeId) {
      return NextResponse.json({ ok: false, error: "sourceTradeId is required" }, { status: 400 })
    }

    const res = await fetch(`${DAEMON_URL}/actions/close-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTradeId }),
    })

    const result = (await res.json()) as { ok: boolean; error?: string }
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Failed to close trade" },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, data: null })
  } catch (error) {
    console.error("[POST /api/tv-alerts/test-signal/close]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
