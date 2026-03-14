import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { validateSession, listActiveSessions, deleteAllSessions } from "@fxflow/db"

export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("fxflow_session")?.value
    if (!token || !(await validateSession(token))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await listActiveSessions()
    return NextResponse.json({ ok: true, data: sessions })
  } catch (error) {
    console.error("[GET /api/auth/sessions]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

/** DELETE all sessions (logout everywhere). */
export async function DELETE(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("fxflow_session")?.value
    if (!token || !(await validateSession(token))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const count = await deleteAllSessions()

    cookieStore.set("fxflow_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })

    return NextResponse.json({ ok: true, data: { revoked: count } })
  } catch (error) {
    console.error("[DELETE /api/auth/sessions]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
