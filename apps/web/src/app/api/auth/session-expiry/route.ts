import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { validateSession, getSessionExpiry, updateSessionExpiry } from "@fxflow/db"

export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("fxflow_session")?.value
    if (!token || !(await validateSession(token))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const expiry = await getSessionExpiry()
    return NextResponse.json({ ok: true, data: { sessionExpiry: expiry } })
  } catch (error) {
    console.error("[GET /api/auth/session-expiry]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("fxflow_session")?.value
    if (!token || !(await validateSession(token))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { seconds?: number }
    const seconds = body.seconds

    const allowed = [3600, 28800, 86400, 604800, 2592000] // 1h, 8h, 24h, 7d, 30d
    if (!seconds || !allowed.includes(seconds)) {
      return NextResponse.json(
        { ok: false, error: "Invalid expiry. Allowed: 3600, 28800, 86400, 604800, 2592000" },
        { status: 400 },
      )
    }

    await updateSessionExpiry(seconds)
    return NextResponse.json({ ok: true, data: { sessionExpiry: seconds } })
  } catch (error) {
    console.error("[PUT /api/auth/session-expiry]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
