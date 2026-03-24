import { NextResponse } from "next/server"
import type { ApiResponse, AiTraderScanProgressData } from "@fxflow/types"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

export async function GET() {
  try {
    const res = await fetch(`${DAEMON_URL}/ai-trader/scan-progress`)
    if (!res.ok) {
      throw new Error(`Daemon returned ${res.status}`)
    }
    const json = (await res.json()) as ApiResponse<AiTraderScanProgressData | null>
    return NextResponse.json<ApiResponse<AiTraderScanProgressData | null>>({
      ok: true,
      data: json.data ?? null,
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/scan-progress]", error)
    return NextResponse.json<ApiResponse<AiTraderScanProgressData | null>>(
      { ok: false, error: "Failed to fetch scan progress" },
      { status: 502 },
    )
  }
}
