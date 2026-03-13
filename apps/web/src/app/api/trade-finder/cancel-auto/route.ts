import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function POST(): Promise<NextResponse<ApiResponse<{ cancelled: number }>>> {
  try {
    const res = await fetch(`${DAEMON_URL}/actions/trade-finder/cancel-auto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { ok: false, error: text || `Daemon returned ${res.status}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json({ ok: true, data: { cancelled: data.cancelled ?? 0 } })
  } catch (error) {
    console.error("[POST /api/trade-finder/cancel-auto]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to reach daemon" },
      { status: 502 },
    )
  }
}
