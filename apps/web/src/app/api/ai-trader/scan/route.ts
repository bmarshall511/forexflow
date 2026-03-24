import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

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
      { ok: false, error: "Failed to trigger EdgeFinder scan" },
      { status: 502 },
    )
  }
}
