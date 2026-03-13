import { NextResponse, type NextRequest } from "next/server"
import { deleteTag } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params
    await deleteTag(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/tags/[id]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
