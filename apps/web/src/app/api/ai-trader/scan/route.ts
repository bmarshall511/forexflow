import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function POST() {
  try {
    const res = await fetch(`${DAEMON_URL}/actions/ai-trader/scan`, {
      method: "POST",
    })
    if (!res.ok) {
      throw new Error(`Daemon returned ${res.status}`)
    }
    const data = (await res.json()) as { triggered: boolean }
    return NextResponse.json<ApiResponse<{ triggered: boolean }>>({
      ok: true,
      data,
    })
  } catch (error) {
    console.error("[POST /api/ai-trader/scan]", error)
    return NextResponse.json<ApiResponse<{ triggered: boolean }>>(
      { ok: false, error: "Failed to trigger AI Trader scan" },
      { status: 502 },
    )
  }
}
