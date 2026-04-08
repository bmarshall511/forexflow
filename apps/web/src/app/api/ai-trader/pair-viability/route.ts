import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

export interface PairViabilityEntry {
  pair: string
  profile: string
  status: "viable" | "marginal" | "blocked" | "unknown"
  spreadPips: number
  atrPips: number | null
  rawRR: number | null
  spreadPercent: number | null
}

export async function GET() {
  try {
    const res = await fetch(`${DAEMON_URL}/ai-trader/pair-viability`)
    if (!res.ok) {
      throw new Error(`Daemon returned ${res.status}`)
    }
    const json = (await res.json()) as ApiResponse<PairViabilityEntry[]>
    return NextResponse.json<ApiResponse<PairViabilityEntry[]>>({
      ok: true,
      data: json.data ?? [],
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/pair-viability]", error)
    return NextResponse.json<ApiResponse<PairViabilityEntry[]>>(
      { ok: false, error: "Failed to fetch pair viability" },
      { status: 502 },
    )
  }
}
