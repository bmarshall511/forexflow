import { NextResponse, type NextRequest } from "next/server"
import { dismissNotification, deleteNotification } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.dismissed === true) {
      const result = await dismissNotification(id)
      if (!result) {
        return NextResponse.json({ ok: false, error: "Notification not found" }, { status: 404 })
      }
      return NextResponse.json({ ok: true, data: result })
    }

    return NextResponse.json({ ok: false, error: "Invalid update" }, { status: 400 })
  } catch (error) {
    console.error("[PATCH /api/notifications/[id]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params
    const deleted = await deleteNotification(id)
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Notification not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/notifications/[id]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
