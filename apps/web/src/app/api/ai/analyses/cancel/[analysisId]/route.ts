import { NextResponse, type NextRequest } from "next/server"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { analysisId } = await params

    try {
      const res = await fetch(`${DAEMON_URL}/actions/ai/cancel/${analysisId}`, { method: "POST" })
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `Daemon returned ${res.status}` },
          { status: 502 },
        )
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Daemon unreachable" }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/ai/analyses/cancel/[analysisId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
