import { NextResponse } from "next/server"
import type { ApiResponse, AiTraderScanLogEntry } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function GET() {
  try {
    const res = await fetch(`${DAEMON_URL}/ai-trader/scan-log`)
    if (!res.ok) {
      throw new Error(`Daemon returned ${res.status}`)
    }
    const json = (await res.json()) as ApiResponse<AiTraderScanLogEntry[]>
    return NextResponse.json<ApiResponse<AiTraderScanLogEntry[]>>({
      ok: true,
      data: json.data ?? [],
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/scan-log]", error)
    return NextResponse.json<ApiResponse<AiTraderScanLogEntry[]>>(
      { ok: false, error: "Failed to fetch scan log" },
      { status: 502 },
    )
  }
}
