import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function POST() {
  try {
    const res = await fetch(`${DAEMON_URL}/actions/ai-trader/pause`, {
      method: "POST",
    })
    if (!res.ok) {
      throw new Error(`Daemon returned ${res.status}`)
    }
    return NextResponse.json<ApiResponse<null>>({ ok: true, data: null })
  } catch (error) {
    console.error("[POST /api/ai-trader/pause]", error)
    return NextResponse.json<ApiResponse<null>>(
      { ok: false, error: "Failed to pause AI Trader scanner" },
      { status: 502 },
    )
  }
}
