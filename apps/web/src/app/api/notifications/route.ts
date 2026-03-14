import { NextResponse, type NextRequest } from "next/server"
import {
  listNotifications,
  dismissAllNotifications,
  deleteAllDismissed,
  createNotification,
} from "@fxflow/db"
import type {
  ApiResponse,
  NotificationListResponse,
  NotificationSeverity,
  NotificationSource,
} from "@fxflow/types"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<NotificationListResponse>>> {
  try {
    const { searchParams } = request.nextUrl
    const dismissed = searchParams.get("dismissed")
    const severity = searchParams.get("severity") as NotificationSeverity | null
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    const result = await listNotifications({
      dismissed: dismissed !== null ? dismissed === "true" : undefined,
      severity: severity ?? undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("[GET /api/notifications]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const body = await request.json()
    const { action } = body as { action: string }

    switch (action) {
      case "dismiss_all": {
        const count = await dismissAllNotifications()
        return NextResponse.json({ ok: true, data: { count } })
      }
      case "delete_dismissed": {
        const count = await deleteAllDismissed()
        return NextResponse.json({ ok: true, data: { count } })
      }
      case "create": {
        const { severity, source, title, message } = body as {
          severity: NotificationSeverity
          source: NotificationSource
          title: string
          message: string
        }
        if (!severity || !source || !title || !message) {
          return NextResponse.json(
            { ok: false, error: "Missing required fields: severity, source, title, message" },
            { status: 400 },
          )
        }
        const notification = await createNotification({ severity, source, title, message })
        return NextResponse.json({ ok: true, data: notification })
      }
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error("[POST /api/notifications]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
