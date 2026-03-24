import { NextResponse, type NextRequest } from "next/server"
import { setTVAlertsKillSwitch } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ enabled: boolean }>>> {
  try {
    const { enabled } = (await request.json()) as { enabled: boolean }
    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "enabled (boolean) is required" },
        { status: 400 },
      )
    }

    // Update DB
    await setTVAlertsKillSwitch(enabled)

    // Notify daemon
    try {
      await fetch(`${DAEMON_URL}/actions/tv-alerts/kill-switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
    } catch {
      // Daemon may be down — DB update still persists
      console.warn("[POST /api/tv-alerts/kill-switch] Failed to notify daemon")
    }

    return NextResponse.json({ ok: true, data: { enabled } })
  } catch (error) {
    console.error("[POST /api/tv-alerts/kill-switch]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
