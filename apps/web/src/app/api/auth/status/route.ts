import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { hasPin, validateSession } from "@fxflow/db"

export async function GET(): Promise<NextResponse> {
  try {
    const pinExists = await hasPin()

    let isAuthenticated = false
    if (pinExists) {
      const cookieStore = await cookies()
      const token = cookieStore.get("fxflow_session")?.value
      if (token) {
        isAuthenticated = await validateSession(token)
      }
    }

    return NextResponse.json({ ok: true, data: { hasPin: pinExists, isAuthenticated } })
  } catch (error) {
    console.error("[GET /api/auth/status]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
