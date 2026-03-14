import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { validateSession, revokeSession } from "@fxflow/db"

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("fxflow_session")?.value
    if (!token || !(await validateSession(token))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { sessionId?: string }
    if (!body.sessionId) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 })
    }

    await revokeSession(body.sessionId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/auth/sessions/revoke]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
