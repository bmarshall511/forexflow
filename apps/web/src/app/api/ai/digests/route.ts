import { NextResponse, type NextRequest } from "next/server"
import { listDigests, createDigest } from "@fxflow/db"
import type { ApiResponse, AiDigestData } from "@fxflow/types"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ items: AiDigestData[]; total: number }>>> {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") as "weekly" | "monthly" | undefined
    const limit = parseInt(searchParams.get("limit") ?? "20", 10)
    const offset = parseInt(searchParams.get("offset") ?? "0", 10)

    const result = await listDigests({ period: period || undefined, limit, offset })
    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("[GET /api/ai/digests]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ digestId: string }>>> {
  try {
    const body = (await request.json()) as {
      period: "weekly" | "monthly"
      periodStart: string
      periodEnd: string
    }

    const digestId = await createDigest({
      period: body.period,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    })

    // Notify daemon to generate the digest
    const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"
    try {
      await fetch(`${DAEMON_URL}/actions/ai/generate-digest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId }),
      })
    } catch {
      console.warn("[POST /api/ai/digests] Failed to notify daemon")
    }

    return NextResponse.json({ ok: true, data: { digestId } })
  } catch (error) {
    console.error("[POST /api/ai/digests]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
