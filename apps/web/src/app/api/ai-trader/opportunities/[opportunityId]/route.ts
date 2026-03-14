import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  try {
    const { opportunityId } = await params
    const body = (await request.json()) as { action: "approve" | "reject" }

    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json<ApiResponse<{ status: string }>>(
        { ok: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 },
      )
    }

    const endpoint =
      body.action === "approve"
        ? `${DAEMON_URL}/actions/ai-trader/approve/${opportunityId}`
        : `${DAEMON_URL}/actions/ai-trader/reject/${opportunityId}`

    const res = await fetch(endpoint, { method: "POST" })
    if (!res.ok) {
      throw new Error(`Daemon returned ${res.status}`)
    }
    const data = (await res.json()) as { status: string }
    return NextResponse.json<ApiResponse<{ status: string }>>({
      ok: true,
      data,
    })
  } catch (error) {
    console.error("[POST /api/ai-trader/opportunities/[opportunityId]]", error)
    return NextResponse.json<ApiResponse<{ status: string }>>(
      { ok: false, error: "Failed to process opportunity action" },
      { status: 502 },
    )
  }
}
