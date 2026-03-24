import { NextResponse } from "next/server"
import type { ApiResponse, AiTraderScanStatus } from "@fxflow/types"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

export async function GET() {
  try {
    const res = await fetch(`${DAEMON_URL}/ai-trader/status`)
    if (!res.ok) {
      throw new Error(`Daemon returned ${res.status}`)
    }
    const json = (await res.json()) as ApiResponse<AiTraderScanStatus>
    return NextResponse.json<ApiResponse<AiTraderScanStatus>>({
      ok: true,
      data: json.data ?? (json as unknown as AiTraderScanStatus),
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/status]", error)
    return NextResponse.json<ApiResponse<AiTraderScanStatus>>(
      { ok: false, error: "Failed to fetch EdgeFinder status" },
      { status: 502 },
    )
  }
}
