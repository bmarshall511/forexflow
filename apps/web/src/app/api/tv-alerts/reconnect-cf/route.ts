import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function POST(): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const res = await fetch(`${DAEMON_URL}/actions/tv-alerts/reconnect-cf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return NextResponse.json(
        { ok: false, error: (body as { error?: string }).error ?? "Daemon error" },
        { status: res.status },
      )
    }

    return NextResponse.json({ ok: true, data: null })
  } catch {
    // Daemon may be down
    return NextResponse.json(
      { ok: false, error: "Failed to reach daemon. Is it running?" },
      { status: 502 },
    )
  }
}
