import { NextResponse, type NextRequest } from "next/server"
import { getDigest, deleteDigest } from "@fxflow/db"
import type { ApiResponse, AiDigestData } from "@fxflow/types"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ digestId: string }> },
): Promise<NextResponse<ApiResponse<AiDigestData | null>>> {
  try {
    const { digestId } = await params
    const digest = await getDigest(digestId)
    if (!digest) {
      return NextResponse.json({ ok: false, error: "Digest not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: digest })
  } catch (error) {
    console.error("[GET /api/ai/digests/[digestId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ digestId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { digestId } = await params
    const deleted = await deleteDigest(digestId)
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Digest not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/ai/digests/[digestId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
